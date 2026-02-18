-- Seed data for wa_bridge development
-- Run with: supabase db reset (applies migrations then seeds)

-- Contacts
INSERT INTO wa_bridge.contacts (phone_number, push_name, first_seen_at, last_seen_at) VALUES
  ('5511999990001', 'Maria Silva',    now() - interval '30 days', now() - interval '2 hours'),
  ('5511999990002', 'João Santos',    now() - interval '25 days', now() - interval '1 hour'),
  ('5511999990003', 'Ana Oliveira',   now() - interval '20 days', now() - interval '30 minutes'),
  ('5511999990004', 'Carlos Souza',   now() - interval '15 days', now() - interval '3 hours'),
  ('5511999990005', 'Fernanda Lima',  now() - interval '10 days', now() - interval '5 hours'),
  ('5511999990006', 'Rafael Costa',   now() - interval '7 days',  now() - interval '1 day'),
  ('5511999990007', 'Beatriz Almeida',now() - interval '5 days',  now() - interval '6 hours'),
  ('5511999990008', 'Lucas Ferreira', now() - interval '3 days',  now() - interval '4 hours'),
  ('5511999990009', 'Patrícia Rocha', now() - interval '2 days',  now() - interval '12 hours'),
  ('5511999990010', 'Thiago Mendes',  now() - interval '1 day',   now() - interval '20 minutes')
ON CONFLICT (phone_number) DO NOTHING;

-- Chats (1:1 and group)
INSERT INTO wa_bridge.chats (chat_id, is_group, name, created_at, last_message_at) VALUES
  ('5511999990001@s.whatsapp.net', false, 'Maria Silva',     now() - interval '30 days', now() - interval '5 minutes'),
  ('5511999990002@s.whatsapp.net', false, 'João Santos',     now() - interval '25 days', now() - interval '15 minutes'),
  ('5511999990003@s.whatsapp.net', false, 'Ana Oliveira',    now() - interval '20 days', now() - interval '1 hour'),
  ('5511999990004@s.whatsapp.net', false, 'Carlos Souza',    now() - interval '15 days', now() - interval '3 hours'),
  ('5511999990005@s.whatsapp.net', false, 'Fernanda Lima',   now() - interval '10 days', now() - interval '1 day'),
  ('5511999990006@s.whatsapp.net', false, 'Rafael Costa',    now() - interval '7 days',  now() - interval '2 days'),
  ('5511999990007@s.whatsapp.net', false, 'Beatriz Almeida', now() - interval '5 days',  now() - interval '3 days'),
  ('5511999990008@s.whatsapp.net', false, 'Lucas Ferreira',  now() - interval '3 days',  now() - interval '5 days'),
  ('120363001@g.us',               true,  'Equipe Vendas',   now() - interval '20 days', now() - interval '10 minutes'),
  ('120363002@g.us',               true,  'Suporte Técnico', now() - interval '14 days', now() - interval '2 hours')
ON CONFLICT (chat_id) DO NOTHING;

-- Messages for Maria Silva (active conversation)
INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, content, is_from_me, is_agent, "timestamp") VALUES
  ('msg_maria_01', '5511999990001@s.whatsapp.net', '5511999990001', 'Maria Silva', 'text', 'Oi, tudo bem? Vi o anúncio de vocês no Instagram.', false, false, now() - interval '2 hours'),
  ('msg_maria_02', '5511999990001@s.whatsapp.net', null, null, 'text', 'Olá Maria! Tudo ótimo, obrigado pelo interesse! Como posso ajudar?', true, false, now() - interval '1 hour 55 minutes'),
  ('msg_maria_03', '5511999990001@s.whatsapp.net', '5511999990001', 'Maria Silva', 'text', 'Quero saber mais sobre o plano empresarial. Qual o valor?', false, false, now() - interval '1 hour 50 minutes'),
  ('msg_maria_04', '5511999990001@s.whatsapp.net', null, null, 'text', 'O plano empresarial custa R$ 299/mês e inclui até 10 usuários. Posso enviar a proposta completa?', true, true, now() - interval '1 hour 45 minutes'),
  ('msg_maria_05', '5511999990001@s.whatsapp.net', '5511999990001', 'Maria Silva', 'text', 'Sim, por favor! Pode enviar por aqui mesmo.', false, false, now() - interval '1 hour 30 minutes'),
  ('msg_maria_06', '5511999990001@s.whatsapp.net', null, null, 'text', 'Segue a proposta em anexo. Qualquer dúvida estou à disposição!', true, false, now() - interval '30 minutes'),
  ('msg_maria_07', '5511999990001@s.whatsapp.net', '5511999990001', 'Maria Silva', 'text', 'Recebi! Vou analisar e retorno até amanhã. Obrigada!', false, false, now() - interval '5 minutes')
ON CONFLICT (message_id, chat_id) DO NOTHING;

-- Messages for João Santos
INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, content, is_from_me, is_agent, "timestamp") VALUES
  ('msg_joao_01', '5511999990002@s.whatsapp.net', '5511999990002', 'João Santos', 'text', 'Boa tarde! Tenho interesse no produto X.', false, false, now() - interval '3 hours'),
  ('msg_joao_02', '5511999990002@s.whatsapp.net', null, null, 'text', 'Boa tarde João! O produto X está disponível. Quer que eu envie as especificações?', true, true, now() - interval '2 hours 55 minutes'),
  ('msg_joao_03', '5511999990002@s.whatsapp.net', '5511999990002', 'João Santos', 'text', 'Pode sim, e também o preço pra quantidade acima de 100 unidades.', false, false, now() - interval '2 hours 40 minutes'),
  ('msg_joao_04', '5511999990002@s.whatsapp.net', null, null, 'text', 'Para acima de 100 unidades temos desconto de 15%. Vou preparar o orçamento.', true, false, now() - interval '15 minutes')
ON CONFLICT (message_id, chat_id) DO NOTHING;

-- Messages for Ana Oliveira
INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, content, is_from_me, is_agent, "timestamp") VALUES
  ('msg_ana_01', '5511999990003@s.whatsapp.net', '5511999990003', 'Ana Oliveira', 'text', 'Olá! Gostaria de agendar uma demonstração do sistema.', false, false, now() - interval '5 hours'),
  ('msg_ana_02', '5511999990003@s.whatsapp.net', null, null, 'text', 'Claro Ana! Temos horários disponíveis amanhã às 10h ou 14h. Qual prefere?', true, true, now() - interval '4 hours 50 minutes'),
  ('msg_ana_03', '5511999990003@s.whatsapp.net', '5511999990003', 'Ana Oliveira', 'text', 'Às 14h fica perfeito.', false, false, now() - interval '4 hours 30 minutes'),
  ('msg_ana_04', '5511999990003@s.whatsapp.net', null, null, 'text', 'Agendado! Enviei o link da reunião no seu email.', true, false, now() - interval '1 hour'),
  ('msg_ana_05', '5511999990003@s.whatsapp.net', '5511999990003', 'Ana Oliveira', 'text', 'Perfeito, obrigada!', false, false, now() - interval '1 hour')
ON CONFLICT (message_id, chat_id) DO NOTHING;

-- Messages for Carlos Souza (support issue)
INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, content, is_from_me, is_agent, "timestamp") VALUES
  ('msg_carlos_01', '5511999990004@s.whatsapp.net', '5511999990004', 'Carlos Souza', 'text', 'Estou com problema no login do sistema. Não consigo acessar.', false, false, now() - interval '6 hours'),
  ('msg_carlos_02', '5511999990004@s.whatsapp.net', null, null, 'text', 'Olá Carlos! Vou verificar sua conta. Pode me informar seu email cadastrado?', true, true, now() - interval '5 hours 55 minutes'),
  ('msg_carlos_03', '5511999990004@s.whatsapp.net', '5511999990004', 'Carlos Souza', 'text', 'carlos.souza@empresa.com', false, false, now() - interval '5 hours 50 minutes'),
  ('msg_carlos_04', '5511999990004@s.whatsapp.net', null, null, 'text', 'Encontrei o problema. Sua senha expirou. Acabei de enviar um link de redefinição pro seu email.', true, false, now() - interval '3 hours 30 minutes'),
  ('msg_carlos_05', '5511999990004@s.whatsapp.net', '5511999990004', 'Carlos Souza', 'text', 'Consegui! Valeu pela ajuda rápida.', false, false, now() - interval '3 hours')
ON CONFLICT (message_id, chat_id) DO NOTHING;

-- Messages for Fernanda Lima (older conversation)
INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, content, is_from_me, is_agent, "timestamp") VALUES
  ('msg_fer_01', '5511999990005@s.whatsapp.net', '5511999990005', 'Fernanda Lima', 'text', 'Oi, vocês fazem integração com o sistema ERP da TOTVS?', false, false, now() - interval '2 days'),
  ('msg_fer_02', '5511999990005@s.whatsapp.net', null, null, 'text', 'Sim, temos integração nativa com TOTVS Protheus e RM. Quer que eu agende uma call técnica?', true, true, now() - interval '2 days' + interval '10 minutes'),
  ('msg_fer_03', '5511999990005@s.whatsapp.net', '5511999990005', 'Fernanda Lima', 'text', 'Seria ótimo! Pode ser na próxima semana?', false, false, now() - interval '1 day')
ON CONFLICT (message_id, chat_id) DO NOTHING;

-- Messages for Rafael Costa (cold lead)
INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, content, is_from_me, is_agent, "timestamp") VALUES
  ('msg_rafa_01', '5511999990006@s.whatsapp.net', '5511999990006', 'Rafael Costa', 'text', 'Vi que vocês têm uma solução pra gestão de estoque. Podem me mandar material?', false, false, now() - interval '3 days'),
  ('msg_rafa_02', '5511999990006@s.whatsapp.net', null, null, 'text', 'Claro Rafael! Vou enviar nosso catálogo e um case de sucesso de um cliente do mesmo segmento.', true, false, now() - interval '2 days')
ON CONFLICT (message_id, chat_id) DO NOTHING;

-- Messages for Beatriz Almeida (image message)
INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, media_type, content, is_from_me, is_agent, "timestamp") VALUES
  ('msg_bia_01', '5511999990007@s.whatsapp.net', '5511999990007', 'Beatriz Almeida', 'text', null, 'Olá! Estou com erro na tela de relatórios. Segue o print.', false, false, now() - interval '4 days'),
  ('msg_bia_02', '5511999990007@s.whatsapp.net', '5511999990007', 'Beatriz Almeida', 'image', 'image/jpeg', null, false, false, now() - interval '4 days' + interval '1 minute'),
  ('msg_bia_03', '5511999990007@s.whatsapp.net', null, null, 'text', null, 'Obrigado pelo print, Beatriz! Vou encaminhar para o time técnico analisar.', true, false, now() - interval '3 days')
ON CONFLICT (message_id, chat_id) DO NOTHING;

-- Messages for Equipe Vendas (group chat)
INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, content, is_from_me, is_agent, "timestamp") VALUES
  ('msg_group1_01', '120363001@g.us', '5511999990002', 'João Santos',   'text', 'Pessoal, fechamos 3 contratos essa semana!', false, false, now() - interval '1 hour'),
  ('msg_group1_02', '120363001@g.us', '5511999990003', 'Ana Oliveira',  'text', 'Parabéns time! Qual foi o ticket médio?',     false, false, now() - interval '50 minutes'),
  ('msg_group1_03', '120363001@g.us', '5511999990002', 'João Santos',   'text', 'R$ 450/mês cada. Total de R$ 1.350 MRR novo.',false, false, now() - interval '45 minutes'),
  ('msg_group1_04', '120363001@g.us', null, null,                         'text', 'Excelente resultado! Vamos manter o ritmo.',  true,  false, now() - interval '10 minutes')
ON CONFLICT (message_id, chat_id) DO NOTHING;

-- Messages for Suporte Técnico (group chat)
INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, content, is_from_me, is_agent, "timestamp") VALUES
  ('msg_group2_01', '120363002@g.us', '5511999990004', 'Carlos Souza',    'text', 'Alguém mais reportou problema de lentidão hoje?', false, false, now() - interval '4 hours'),
  ('msg_group2_02', '120363002@g.us', '5511999990007', 'Beatriz Almeida', 'text', 'Sim, vários clientes reclamaram.',                 false, false, now() - interval '3 hours 50 minutes'),
  ('msg_group2_03', '120363002@g.us', null, null,                           'text', 'Identificamos o problema no servidor. Estamos resolvendo.', true, false, now() - interval '2 hours')
ON CONFLICT (message_id, chat_id) DO NOTHING;
