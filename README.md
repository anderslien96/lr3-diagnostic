# LR3 Diagnostic Expert System

AI-powered Land Rover Discovery 3 diagnostic tool. Built with React + Vite.

## Deploy to Vercel (step-by-step)

### 1. Get your Anthropic API key
- Go to https://console.anthropic.com
- Create an account or log in
- Go to **API Keys** → **Create Key**
- Copy the key (starts with `sk-ant-...`)

### 2. Upload to GitHub
- Go to https://github.com/new and create a new repository called `lr3-diagnostic`
- Upload all these files (drag & drop the folder contents)

### 3. Deploy on Vercel
- Go to https://vercel.com/new
- Click **Import Git Repository** → connect your GitHub
- Select the `lr3-diagnostic` repo
- Click **Deploy** (default settings are fine)

### 4. Add your API key
- After deploy, go to your project **Settings → Environment Variables**
- Add: `VITE_ANTHROPIC_API_KEY` = your key from step 1
- Click **Redeploy** (Settings → Deployments → Redeploy)

### 5. Install as app on phone
- Open your Vercel URL on your phone
- **iPhone (Safari):** Tap Share → "Add to Home Screen"
- **Android (Chrome):** Tap menu → "Add to Home Screen"

Done! You now have a native-feeling app on your phone.

## Local development

```bash
npm install
echo "VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env.local
npm run dev
```
