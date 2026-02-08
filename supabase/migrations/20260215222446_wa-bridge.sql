create schema if not exists "wa_bridge";

grant usage on schema "wa_bridge" to "authenticated";


  create table "wa_bridge"."chats" (
    "chat_id" text not null,
    "is_group" boolean not null default false,
    "name" character varying,
    "created_at" timestamp without time zone default now(),
    "last_message_at" timestamp without time zone
      );


alter table "wa_bridge"."chats" enable row level security;


  create table "wa_bridge"."contacts" (
    "phone_number" text not null,
    "push_name" character varying,
    "first_seen_at" timestamp without time zone default now(),
    "last_seen_at" timestamp without time zone default now()
      );


alter table "wa_bridge"."contacts" enable row level security;


  create table "wa_bridge"."messages" (
    "message_id" text not null,
    "chat_id" text not null,
    "sender_id" text,
    "sender_name" character varying,
    "message_type" character varying not null default 'text'::character varying,
    "media_type" character varying,
    "content" text,
    "is_from_me" boolean not null default false,
    "is_agent" boolean not null default false,
    "timestamp" timestamp without time zone,
    "created_at" timestamp without time zone default now()
      );


alter table "wa_bridge"."messages" enable row level security;

CREATE UNIQUE INDEX chats_pkey ON wa_bridge.chats USING btree (chat_id);

CREATE UNIQUE INDEX contacts_pkey ON wa_bridge.contacts USING btree (phone_number);

CREATE UNIQUE INDEX messages_pkey ON wa_bridge.messages USING btree (message_id, chat_id);

alter table "wa_bridge"."chats" add constraint "chats_pkey" PRIMARY KEY using index "chats_pkey";

alter table "wa_bridge"."contacts" add constraint "contacts_pkey" PRIMARY KEY using index "contacts_pkey";

alter table "wa_bridge"."messages" add constraint "messages_pkey" PRIMARY KEY using index "messages_pkey";

alter table "wa_bridge"."messages" add constraint "fk_messages_chat" FOREIGN KEY (chat_id) REFERENCES wa_bridge.chats(chat_id) not valid;

alter table "wa_bridge"."messages" validate constraint "fk_messages_chat";

alter table "wa_bridge"."messages" add constraint "fk_messages_sender" FOREIGN KEY (sender_id) REFERENCES wa_bridge.contacts(phone_number) not valid;

alter table "wa_bridge"."messages" validate constraint "fk_messages_sender";

grant delete on table "wa_bridge"."chats" to "authenticated";

grant insert on table "wa_bridge"."chats" to "authenticated";

grant select on table "wa_bridge"."chats" to "authenticated";

grant update on table "wa_bridge"."chats" to "authenticated";

grant delete on table "wa_bridge"."contacts" to "authenticated";

grant insert on table "wa_bridge"."contacts" to "authenticated";

grant select on table "wa_bridge"."contacts" to "authenticated";

grant update on table "wa_bridge"."contacts" to "authenticated";

grant delete on table "wa_bridge"."messages" to "authenticated";

grant insert on table "wa_bridge"."messages" to "authenticated";

grant select on table "wa_bridge"."messages" to "authenticated";

grant update on table "wa_bridge"."messages" to "authenticated";


  create policy "auth_users_chats"
  on "wa_bridge"."chats"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "auth_users_contacts"
  on "wa_bridge"."contacts"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "auth_users_messages"
  on "wa_bridge"."messages"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



