"""Media description service for WhatsApp bridge.

Watches wa_bridge.messages for media without descriptions via Supabase
Realtime postgres_changes, downloads from Supabase Storage, processes
with local ML models, and writes descriptions back.

No DATABASE_URL needed — uses SUPABASE_URL + SUPABASE_SERVICE_KEY only.
"""

import asyncio
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from dotenv import load_dotenv

load_dotenv()

from supabase._async.client import AsyncClient, create_client

from processors.audio import AudioProcessor
from processors.document import DocumentProcessor

logging.basicConfig(
    level=os.environ.get('LOG_LEVEL', 'INFO').upper(),
    format='%(asctime)s %(levelname)-8s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('describer')

PROCESSING_SENTINEL = '__processing__'
FAILED_PREFIX = '__failed__:'


def get_config():
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SERVICE_KEY')
    if not supabase_url or not supabase_key:
        log.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required')
        sys.exit(1)

    return {
        'supabase_url': supabase_url,
        'supabase_key': supabase_key,
        'whisper_model': os.environ.get(
            'WHISPER_MODEL', 'mlx-community/whisper-base-mlx'
        ),
        'whisper_language': os.environ.get('WHISPER_LANGUAGE', 'pt'),
        'concurrency': int(os.environ.get('CONCURRENCY', '2')),
    }


async def download_media(sb: AsyncClient, media_path: str) -> bytes:
    """Download a file from Supabase Storage."""
    return await sb.storage.from_('wa-media').download(media_path)


async def reset_stale(sb: AsyncClient):
    """Reset any rows stuck in processing state from a previous crash."""
    resp = await (
        sb.table('messages')
        .update({'description': None})
        .eq('description', PROCESSING_SENTINEL)
        .execute()
    )
    if resp.data:
        log.info('Reset %d stale processing rows', len(resp.data))


async def get_pending(sb: AsyncClient) -> list[dict]:
    """Get media messages that need description."""
    resp = await (
        sb.table('messages')
        .select('message_id, chat_id, media_type, media_path')
        .in_('media_type', ['audio', 'image', 'document'])
        .not_.is_('media_path', 'null')
        .is_('description', 'null')
        .order('timestamp')
        .limit(50)
        .execute()
    )
    return resp.data


async def claim_message(
    sb: AsyncClient, message_id: str, chat_id: str
) -> dict | None:
    """Atomically claim a message for processing."""
    resp = await (
        sb.table('messages')
        .update({'description': PROCESSING_SENTINEL})
        .eq('message_id', message_id)
        .eq('chat_id', chat_id)
        .is_('description', 'null')
        .execute()
    )
    if resp.data:
        return resp.data[0]
    return None


async def mark_described(
    sb: AsyncClient, message_id: str, chat_id: str, description: str
):
    """Write the final description."""
    await (
        sb.table('messages')
        .update({'description': description})
        .eq('message_id', message_id)
        .eq('chat_id', chat_id)
        .execute()
    )


async def mark_failed(sb: AsyncClient, message_id: str, chat_id: str, reason: str):
    """Mark a message as failed so it's not retried."""
    await (
        sb.table('messages')
        .update({'description': f'{FAILED_PREFIX} {reason}'})
        .eq('message_id', message_id)
        .eq('chat_id', chat_id)
        .execute()
    )


# Semaphore to serialize GPU-bound ML inference (Metal doesn't support
# concurrent command buffers from multiple threads).
_gpu_semaphore = asyncio.Semaphore(1)


async def process_one(
    sb: AsyncClient,
    processors: dict,
    executor: ThreadPoolExecutor,
    msg: dict,
):
    """Process a single media message."""
    message_id = msg['message_id']
    chat_id = msg['chat_id']
    media_type = msg.get('media_type', '')
    media_path = msg.get('media_path', '')

    claimed = await claim_message(sb, message_id, chat_id)
    if not claimed:
        return  # already claimed or processed

    processor = processors.get(media_type)
    if not processor:
        log.debug('No processor for media_type=%s, skipping', media_type)
        await mark_failed(sb, message_id, chat_id, f'no processor for {media_type}')
        return

    try:
        log.info(
            'Processing %s message_id=%s chat_id=%s',
            media_type,
            message_id,
            chat_id[:20],
        )
        start = time.monotonic()

        # Download can happen concurrently
        data = await download_media(sb, media_path)

        ext = media_path.rsplit('.', 1)[-1] if '.' in media_path else ''

        # Serialize GPU-bound ML inference — one at a time
        async with _gpu_semaphore:
            loop = asyncio.get_running_loop()
            description = await loop.run_in_executor(
                executor, processor.describe, data, ext
            )

        elapsed = time.monotonic() - start
        log.info(
            'Done %s message_id=%s (%.1fs, %d bytes -> %d chars)',
            media_type,
            message_id,
            elapsed,
            len(data),
            len(description),
        )

        await mark_described(sb, message_id, chat_id, description)

    except Exception:
        log.exception(
            'Failed to process %s message_id=%s', media_type, message_id
        )
        await mark_failed(sb, message_id, chat_id, 'processing error')


async def drain_pending(
    sb: AsyncClient,
    processors: dict,
    executor: ThreadPoolExecutor,
    active: set,
):
    """Process all pending messages."""
    pending = await get_pending(sb)
    if pending:
        log.info('Draining %d pending messages', len(pending))
        for msg in pending:
            key = f"{msg['message_id']}:{msg['chat_id']}"
            if key not in active:
                active.add(key)
                task = asyncio.create_task(
                    _process_and_cleanup(sb, processors, executor, msg, active, key)
                )


async def _process_and_cleanup(sb, processors, executor, msg, active, key):
    """Process a message and remove from active set when done."""
    try:
        await process_one(sb, processors, executor, msg)
    finally:
        active.discard(key)


def _is_describable(record: dict) -> bool:
    """Check if a record from postgres_changes is a describable media message."""
    return (
        record.get('media_type') in ('audio', 'image', 'document')
        and record.get('media_path') is not None
        and record.get('description') is None
    )


async def run(cfg: dict):
    """Main entry point — subscribe to realtime changes and process media."""
    sb = await create_client(cfg['supabase_url'], cfg['supabase_key'])

    processors = {
        'audio': AudioProcessor(
            model=cfg['whisper_model'],
            language=cfg['whisper_language'],
        ),
        'document': DocumentProcessor(),
        # 'image': ImageProcessor() — add when ready
    }

    executor = ThreadPoolExecutor(max_workers=cfg['concurrency'])
    active: set[str] = set()

    log.info(
        'Starting describer (processors: %s, concurrency: %d)',
        ', '.join(processors.keys()),
        cfg['concurrency'],
    )

    # Reset stale rows from previous crash
    await reset_stale(sb)

    # Drain any existing pending messages
    await drain_pending(sb, processors, executor, active)

    # Subscribe to INSERT and UPDATE on wa_bridge.messages
    channel = sb.channel('describer')

    def on_change(payload):
        record = payload.get('data', {}).get('record', {})
        if not record:
            return
        if _is_describable(record):
            key = f"{record['message_id']}:{record['chat_id']}"
            if key not in active:
                active.add(key)
                msg = {
                    'message_id': record['message_id'],
                    'chat_id': record['chat_id'],
                    'media_type': record['media_type'],
                    'media_path': record['media_path'],
                }
                asyncio.ensure_future(
                    _process_and_cleanup(sb, processors, executor, msg, active, key)
                )

    channel.on_postgres_changes(
        event='INSERT',
        callback=on_change,
        schema='wa_bridge',
        table='messages',
    )
    channel.on_postgres_changes(
        event='UPDATE',
        callback=on_change,
        schema='wa_bridge',
        table='messages',
    )

    def on_subscribe(status, err):
        if err:
            log.error('Realtime subscribe error: %s', err)
        else:
            log.info('Realtime subscription status: %s', status)

    await channel.subscribe(on_subscribe)

    log.info('Listening for media messages via Supabase Realtime')

    # Keep alive — the realtime client runs in the background
    try:
        while True:
            await asyncio.sleep(60)
    except asyncio.CancelledError:
        pass
    finally:
        await sb.remove_channel(channel)
        executor.shutdown(wait=True)


def main():
    cfg = get_config()
    try:
        asyncio.run(run(cfg))
    except KeyboardInterrupt:
        log.info('Shutting down...')


if __name__ == '__main__':
    main()
