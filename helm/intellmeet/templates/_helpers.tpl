{{- define "intellmeet.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "intellmeet.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "intellmeet.name" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "intellmeet.labels" -}}
app.kubernetes.io/name: {{ include "intellmeet.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}
