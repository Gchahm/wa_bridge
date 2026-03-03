package agent

import (
	"fmt"
	"strings"
	"time"
)

// buildSystemPrompt constructs the full system prompt for Claude, including
// persona, rules, available actions, response format, and customer context.
func buildSystemPrompt(ctx *CustomerContext, currentDate string) string {
	var b strings.Builder

	// Identity
	b.WriteString(`Você é Gleyci, assistente virtual da Gleyci Turismo, uma agência de viagens brasileira.

## Regras
- Responda SEMPRE em português brasileiro
- Seja simpática, profissional e concisa (respostas curtas, adequadas para WhatsApp)
- Use formatação simples — sem markdown complexo (é WhatsApp)
- NUNCA invente preços ou disponibilidade — diga que vai verificar
- Se não souber algo específico, diga que vai verificar e retornar
- Para mensagens de áudio, você receberá a transcrição no histórico — use-a normalmente para entender o que o cliente disse
- Para imagens, você receberá uma descrição gerada por IA — use-a para entender o contexto
- Para outros tipos de mídia (documentos, etc.) sem descrição, informe que um atendente humano irá processar
- Use ações (actions) para registrar informações no sistema sempre que possível
- NÃO peça todas as informações de uma vez — colete progressivamente de forma natural na conversa
- Quando o cliente mencionar um destino, crie a solicitação de voo imediatamente com o que já tem
- NUNCA ofereça ou sugira classe executiva ou business class — assuma sempre classe econômica. Se o cliente pedir explicitamente outra classe, registre, mas jamais sugira proativamente
- Antes de finalizar o resumo de uma solicitação de voo, pergunte sempre quantas bagagens despachadas o cliente precisará para o voo

## Data Atual
`)
	b.WriteString(currentDate)
	b.WriteString("\n\n")

	// Available Actions
	b.WriteString(`## Ações Disponíveis

Você pode executar ações retornando-as no campo "actions" da sua resposta JSON.

### create_flight_request
Cria uma nova solicitação de voo. Use quando o cliente mencionar que quer viajar.
Parâmetros:
- destination (string, obrigatório): código IATA ou nome da cidade/país
- origin (string): código IATA ou nome da cidade de origem
- departure_date_start (string): data inicial do período de ida (YYYY-MM-DD)
- departure_date_end (string): data final do período de ida (YYYY-MM-DD)
- return_date_start (string): data inicial do período de volta (YYYY-MM-DD)
- return_date_end (string): data final do período de volta (YYYY-MM-DD)
- adults (integer): número de adultos (padrão: 1)
- children (integer): número de crianças
- infants (integer): número de bebês
- cabin_class (string): economy, premium_economy, business, first
- notes (string): observações adicionais

### update_flight_request
Atualiza uma solicitação de voo existente. Use quando o cliente fornecer mais informações.
Parâmetros:
- flight_request_id (string, obrigatório): ID da solicitação
- Mesmos campos opcionais de create_flight_request

### cancel_flight_request
Cancela uma solicitação de voo.
Parâmetros:
- flight_request_id (string, obrigatório): ID da solicitação

### create_passenger
Cria um novo passageiro e vincula ao cliente.
Parâmetros:
- full_name (string, obrigatório): nome completo
- date_of_birth (string): data de nascimento (YYYY-MM-DD)
- gender (string): male ou female
- nationality (string): nacionalidade
- document_type (string): cpf, rg, passport, other
- document_number (string): número do documento
- label (string): relação com o cliente (self, spouse, child, etc.)
- notes (string): observações

### update_passenger
Atualiza dados de um passageiro existente.
Parâmetros:
- passenger_id (string, obrigatório): ID do passageiro
- Mesmos campos opcionais de create_passenger (exceto label)

### link_passenger_to_request
Vincula um passageiro existente a uma solicitação de voo.
Parâmetros:
- flight_request_id (string, obrigatório): ID da solicitação
- passenger_id (string, obrigatório): ID do passageiro

### add_note
Adiciona uma observação a uma entidade.
Parâmetros:
- target_type (string, obrigatório): flight_request, booking, ou passenger
- target_id (string, obrigatório): ID da entidade
- note (string, obrigatório): texto da observação

## Formato de Resposta

Responda SEMPRE em JSON válido com esta estrutura:
` + "```" + `json
{
  "reply": "Mensagem para o cliente (em português)",
  "actions": [
    { "type": "nome_da_acao", "params": { ... } }
  ],
  "internal_note": "Nota opcional para a equipe interna"
}
` + "```" + `

- "done" é opcional — defina como true quando:
  - A solicitação está completa (todas as informações coletadas)
  - O cliente precisa de atendimento humano (preços, confirmações)
  - A conversa não é mais sobre viagens
- "reply" é obrigatório e deve conter a mensagem para o cliente
- "actions" é opcional — inclua apenas quando houver ações a executar
- "internal_note" é opcional — use para sinalizar algo à equipe (ex: "cliente parece ter urgência")
`)

	// Customer Context
	b.WriteString("\n## Contexto do Cliente\n\n")
	if ctx != nil {
		b.WriteString(fmt.Sprintf("**Nome:** %s\n", ctx.Customer.Name))
		if ctx.Customer.Email != "" {
			b.WriteString(fmt.Sprintf("**Email:** %s\n", ctx.Customer.Email))
		}

		// Passengers on file
		if len(ctx.Passengers) > 0 {
			b.WriteString("\n### Passageiros Cadastrados\n\n")
			for _, p := range ctx.Passengers {
				label := ""
				if p.Label != "" {
					label = fmt.Sprintf(" (%s)", p.Label)
				}
				b.WriteString(fmt.Sprintf("- **%s**%s [ID: %s]", p.FullName, label, p.ID))
				if p.DocumentType != "" && p.DocumentNumber != "" {
					b.WriteString(fmt.Sprintf(" — %s: %s", p.DocumentType, p.DocumentNumber))
				}
				b.WriteString("\n")
			}
		}

		// Active Flight Requests
		if len(ctx.FlightRequests) > 0 {
			b.WriteString("\n### Solicitações de Voo Ativas\n\n")
			for _, r := range ctx.FlightRequests {
				b.WriteString(fmt.Sprintf("**Solicitação %s** (status: %s)\n", r.ID, r.Status))
				if r.Origin != "" {
					b.WriteString(fmt.Sprintf("  Origem: %s\n", r.Origin))
				}
				if r.Destination != "" {
					b.WriteString(fmt.Sprintf("  Destino: %s\n", r.Destination))
				}
				if r.DepartureDateStart != "" {
					dep := r.DepartureDateStart
					if r.DepartureDateEnd != "" && r.DepartureDateEnd != r.DepartureDateStart {
						dep += " a " + r.DepartureDateEnd
					}
					b.WriteString(fmt.Sprintf("  Ida: %s\n", dep))
				}
				if r.ReturnDateStart != "" {
					ret := r.ReturnDateStart
					if r.ReturnDateEnd != "" && r.ReturnDateEnd != r.ReturnDateStart {
						ret += " a " + r.ReturnDateEnd
					}
					b.WriteString(fmt.Sprintf("  Volta: %s\n", ret))
				}
				b.WriteString(fmt.Sprintf("  Passageiros: %d adulto(s), %d criança(s), %d bebê(s)\n",
					r.Adults, r.Children, r.Infants))
				if r.CabinClass != "" {
					b.WriteString(fmt.Sprintf("  Classe: %s\n", r.CabinClass))
				}
				if r.Notes != "" {
					b.WriteString(fmt.Sprintf("  Notas: %s\n", r.Notes))
				}
				if len(r.Passengers) > 0 {
					names := make([]string, len(r.Passengers))
					for i, p := range r.Passengers {
						names[i] = p.FullName
					}
					b.WriteString(fmt.Sprintf("  Passageiros vinculados: %s\n", strings.Join(names, ", ")))
				}
				b.WriteString("\n")
			}
		}

		// Active Bookings
		if len(ctx.Bookings) > 0 {
			b.WriteString("\n### Reservas Ativas\n\n")
			for _, bk := range ctx.Bookings {
				b.WriteString(fmt.Sprintf("**Reserva %s** (status: %s)", bk.ID, bk.Status))
				if bk.PNR != "" {
					b.WriteString(fmt.Sprintf(" — PNR: %s", bk.PNR))
				}
				b.WriteString("\n")
				if bk.TotalPrice != "" {
					b.WriteString(fmt.Sprintf("  Valor: %s %s\n", bk.TotalPrice, bk.Currency))
				}
				for _, seg := range bk.Segments {
					flight := ""
					if seg.Airline != "" || seg.FlightNumber != "" {
						flight = fmt.Sprintf(" (%s %s)", seg.Airline, seg.FlightNumber)
					}
					b.WriteString(fmt.Sprintf("  %s → %s%s", seg.Origin, seg.Destination, flight))
					if seg.DepartureAt != "" {
						b.WriteString(fmt.Sprintf(" — %s", seg.DepartureAt))
					}
					b.WriteString("\n")
				}
				b.WriteString("\n")
			}
		}
	} else {
		b.WriteString("Cliente não identificado — trate como uma conversa genérica.\n")
	}

	return b.String()
}

// buildUserMessage formats the chat transcript as the user message for Claude.
func buildUserMessage(messages []ChatMessage) string {
	if len(messages) == 0 {
		return "Nenhuma mensagem anterior no histórico. O cliente acabou de iniciar a conversa."
	}

	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.FixedZone("BRT", -3*60*60)
	}

	var b strings.Builder
	b.WriteString("Histórico recente da conversa:\n\n")

	for _, m := range messages {
		ts := m.Timestamp.In(loc).Format("02/01 15:04")

		var role string
		if m.IsFromMe {
			if m.IsAgent {
				role = "Gleyci (você)"
			} else {
				role = "Atendente"
			}
		} else {
			if m.SenderName != "" {
				role = "Cliente"
			} else {
				role = "Cliente"
			}
		}

		var content string
		switch m.MessageType {
		case "media":
			mediaLabel := m.MediaType
			if mediaLabel == "" {
				mediaLabel = "mídia"
			}
			isAudio := mediaLabel == "audio" || mediaLabel == "ptt"
			descLabel := "Descrição"
			if isAudio {
				descLabel = "Transcrição"
			}
			switch {
			case m.Description != "" && m.Content != "":
				content = fmt.Sprintf("[%s] %s: %q — Legenda: %q", mediaLabel, descLabel, m.Description, m.Content)
			case m.Description != "":
				content = fmt.Sprintf("[%s] %s: %q", mediaLabel, descLabel, m.Description)
			case m.Content != "":
				content = fmt.Sprintf("[%s] %s", mediaLabel, m.Content)
			default:
				content = fmt.Sprintf("[%s]", mediaLabel)
			}
		case "contact":
			content = fmt.Sprintf("[contato] %s", m.Content)
		default:
			content = m.Content
		}

		b.WriteString(fmt.Sprintf("[%s] %s: %s\n", ts, role, content))
	}

	b.WriteString("\nResponda à última mensagem do cliente.")
	return b.String()
}
