// Package metrics defines all Prometheus metrics for the WhatsApp bridge.
// All metrics use the "wabridge_" prefix and are auto-registered via promauto.
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Bucket presets.
	fastBuckets   = []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1}
	slowBuckets   = []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60}
	claudeBuckets = []float64{1, 2, 5, 10, 15, 30, 45, 60, 90, 120}
)

// --- Incoming messages ---

var IncomingMessageTotal = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "wabridge_incoming_message_total",
	Help: "Total incoming WhatsApp messages by type and group status.",
}, []string{"message_type", "is_group"})

var IncomingMessageDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name:    "wabridge_incoming_message_duration_seconds",
	Help:    "Duration of handleMessage sync processing.",
	Buckets: fastBuckets,
}, []string{"message_type"})

// --- Media pipeline ---

var MediaDownloadDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name:    "wabridge_media_download_duration_seconds",
	Help:    "Duration of WhatsApp media downloads.",
	Buckets: slowBuckets,
}, []string{"media_type"})

var MediaUploadDuration = promauto.NewHistogram(prometheus.HistogramOpts{
	Name:    "wabridge_media_upload_duration_seconds",
	Help:    "Duration of Supabase Storage uploads.",
	Buckets: slowBuckets,
})

var MediaPipelineDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name:    "wabridge_media_pipeline_duration_seconds",
	Help:    "Duration of the full media flow (download + upload).",
	Buckets: slowBuckets,
}, []string{"media_type"})

// --- Outbox ---

var OutboxProcessDuration = promauto.NewHistogram(prometheus.HistogramOpts{
	Name:    "wabridge_outbox_process_duration_seconds",
	Help:    "Duration of a full outbox processOne cycle.",
	Buckets: slowBuckets,
})

var OutboxSendDuration = promauto.NewHistogram(prometheus.HistogramOpts{
	Name:    "wabridge_outbox_send_duration_seconds",
	Help:    "Duration of client.SendMessage in outbox.",
	Buckets: slowBuckets,
})

var OutboxProcessTotal = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "wabridge_outbox_process_total",
	Help: "Total outbox message processing outcomes.",
}, []string{"result"})

// --- Agent pipeline ---

var AgentPipelineDuration = promauto.NewHistogram(prometheus.HistogramOpts{
	Name:    "wabridge_agent_pipeline_duration_seconds",
	Help:    "Duration of the full agent pipeline.",
	Buckets: claudeBuckets,
})

var AgentStepDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name:    "wabridge_agent_step_duration_seconds",
	Help:    "Duration of individual agent pipeline steps.",
	Buckets: claudeBuckets,
}, []string{"step"})

var AgentPipelineTotal = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "wabridge_agent_pipeline_total",
	Help: "Total agent pipeline outcomes.",
}, []string{"result"})

var AgentActionTotal = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "wabridge_agent_action_total",
	Help: "Total agent action executions by type and success.",
}, []string{"action_type", "success"})

// --- Webhooks ---

var WebhookDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name:    "wabridge_webhook_duration_seconds",
	Help:    "Duration of webhook HTTP calls.",
	Buckets: slowBuckets,
}, []string{"type"})

var WebhookTotal = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "wabridge_webhook_total",
	Help: "Total webhook call outcomes.",
}, []string{"type", "result"})

// --- Group name resolution ---

var GroupResolveDuration = promauto.NewHistogram(prometheus.HistogramOpts{
	Name:    "wabridge_group_resolve_duration_seconds",
	Help:    "Duration of group name resolution.",
	Buckets: slowBuckets,
})

var GroupResolveTotal = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "wabridge_group_resolve_total",
	Help: "Total group name resolution outcomes.",
}, []string{"result"})

// --- WhatsApp send (cross-cutting) ---

var WASendDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name:    "wabridge_wa_send_duration_seconds",
	Help:    "Duration of client.SendMessage calls by source.",
	Buckets: slowBuckets,
}, []string{"source"})

// --- Connection gauge ---

var WhatsAppConnected = promauto.NewGauge(prometheus.GaugeOpts{
	Name: "wabridge_whatsapp_connected",
	Help: "Whether the WhatsApp client is currently connected (1=yes, 0=no).",
})
