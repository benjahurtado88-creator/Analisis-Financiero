# AI Daily — Pipeline de noticias de IA

Genera un resumen diario filtrado de las fuentes top de IA y lo manda por email + lo publica en el dashboard de Finance.ia.

## Fuentes
- **Everyday AI Podcast** (audio → Whisper Groq → texto)
- **TLDR AI** (newsletter scraping)
- **Ben's Bites** (newsletter scraping)
- **Latent Space** (RSS)
- **Hacker News** (top stories AI/LLM/GPT)

## Stack
- Groq Whisper (`whisper-large-v3-turbo`) — transcripción gratis
- Groq Llama 3.3 70B — filtrado, traducción y resumen
- Gmail SMTP — email (app password)
- GitHub Actions — cron diario 12:00 UTC (= 8am Chile invierno)
- Output: `dashboard/public/data/ai-news/YYYY-MM-DD.json` + `latest.json`

## Correr local

```bash
pip install -r ai_news/requirements.txt
python ai_news/daily_news.py                  # full
python ai_news/daily_news.py --no-email       # sin mandar mail
python ai_news/daily_news.py --no-transcribe  # skip Whisper (rápido)
```

Lee credenciales de `dashboard/.env.local`:
- `GROQ_API_KEY` — ya existente (compartido con Finance.ia)
- `GMAIL_USER` — benjahurtado88@gmail.com
- `GMAIL_APP_PASSWORD` — app password de Gmail (16 chars)
- `AI_NEWS_RECIPIENT` — destinatario del email

## Setup GitHub Secrets (para que corra el cron)

En el repo GitHub → Settings → Secrets and variables → Actions → New repository secret:
- `GROQ_API_KEY`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `AI_NEWS_RECIPIENT`

## Ver el resultado

- Dashboard: `localhost:3420/ai-news`
- Email: bandeja de `benjahurtado88@gmail.com` cada mañana

## Limitaciones conocidas

- Whisper Groq acepta archivos hasta 25MB. Episodios muy largos (>2h) pueden no transcribirse — el pipeline sigue igual con solo el resto de fuentes.
- Cron en GitHub Actions usa UTC. 12:00 UTC = 8am Chile en abril-octubre, 9am en noviembre-marzo. Ajustar el cron si quieres exactamente 8am todo el año.
- Si Groq tiene rate limit en un día puntual, el step falla y no se commitea — sin email ese día.
