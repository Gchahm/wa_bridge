select * from wa_bridge.messages
where message_type = 'other'
order by created_at desc
