# Local LLM for OpenCloud

A powerful OpenCloud web app that integrates local Large Language Models (LLMs) directly into your OpenCloud instance for AI-powered assistance.

<img src="https://github.com/user-attachments/assets/0686df6b-bfcb-4459-8ac5-6e15e551e1bc" />

Original Github repo: https://github.com/markusbegerow/local-llm-opencloud

## Features

### Privacy-First AI Integration
- **All data stays in your browser** - no cloud APIs required
- Support for Ollama, LM Studio, vLLM, and OpenAI-compatible endpoints
- Persistent conversation history stored locally in browser storage
- Real-time chat interface

### Core Functionality
- Multiple LLM configurations (with default selection)
- Conversation history tracking
- Configurable temperature, max tokens, and system prompts
- Test connection tool
- Support for multiple models

## Use Cases
- Product description generation
- Email drafting assistance
- Document summarization
- Data analysis and insights
- General productivity automation

## Requirements
- OpenCloud instance
- LLM Server: One of the following:
  - Local LLM (Ollama, LM Studio, vLLM)
  - Remote OpenAI-compatible API (OpenAI, Azure OpenAI, Together.ai, custom endpoints)
  - Any OpenAI-compatible chat completions endpoint

## Getting Started

### 1. Set Up Your LLM Server

#### Option 1: Ollama (Recommended for beginners)

1. Install Ollama from [ollama.ai](https://ollama.ai)

2. Pull a model (e.g., Llama 3.2):
   ```bash
   ollama pull llama3.2
   ```

3. Ollama automatically runs on `http://localhost:11434`

4. In the app settings, use:
   - API URL: `http://localhost:11434/v1/chat/completions`
   - API Token: `ollama`
   - Model Name: `llama3.2`

#### Option 2: LM Studio

1. Download LM Studio from [lmstudio.ai](https://lmstudio.ai)
2. Download a model from the LM Studio interface
3. Start the local server in LM Studio (usually runs on `http://localhost:1234`)
4. In the app settings, configure accordingly

#### Option 3: Remote OpenAI-compatible endpoints

Any server that implements the OpenAI chat completions API will work, including remote HTTPS endpoints.

**Examples:**
- OpenAI API: `https://api.openai.com/v1/chat/completions`
- Azure OpenAI: `https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2024-02-15-preview`
- Together.ai: `https://api.together.xyz/v1/chat/completions`
- Custom self-hosted endpoints: `https://your-server.com/v1/chat/completions`
- Any other OpenAI-compatible API

### 2. Configure OpenCloud CSP (Content Security Policy)

**IMPORTANT:** OpenCloud enforces Content Security Policy (CSP) which blocks browser connections to external APIs by default. You must configure CSP to allow connections to your LLM endpoints.

#### CSP Configuration File

Create a file `csp.yaml` in your OpenCloud config directory with the following content:

```yaml
directives:
  connect-src:
    - '''self'''
    - '*'
```

This configuration allows the browser to connect to any external endpoint. If you want to be more restrictive, you can specify only your LLM endpoints:

```yaml
directives:
  connect-src:
    - '''self'''
    - 'http://localhost:11434'  # Ollama
    - 'http://localhost:1234'   # LM Studio
    - 'https://api.openai.com'  # OpenAI
    # Add other endpoints as needed
```

#### Docker Deployment

When running OpenCloud with Docker, mount the CSP configuration file and set the environment variable:

```bash
docker run --name opencloud -d \
  -p 9200:9200 \
  -v $HOME/opencloud/opencloud-config:/etc/opencloud \
  -v $HOME/opencloud/opencloud-data:/var/lib/opencloud \
  -v $HOME/opencloud/opencloud-apps:/var/lib/opencloud/web/apps \
  -v $HOME/opencloud/opencloud-apps-web:/var/lib/opencloud/web/assets/apps \
  -e OC_URL=https://localhost:9200 \
  -e PROXY_CSP_CONFIG_FILE_LOCATION=/etc/opencloud/csp.yaml \
  opencloudeu/opencloud-rolling:latest
```

Make sure your `csp.yaml` file is in `$HOME/opencloud/opencloud-config/` directory.

#### Non-Docker Deployment

For non-Docker deployments, consult the [OpenCloud CSP documentation](https://docs.opencloud.eu) for how to configure CSP in your specific setup.

### 3. Build the App

1. Install [pnpm](https://pnpm.io/installation) if you haven't already.
   > **Correct version:** Our `package.json` holds a `packageManager` field. Please make sure that you have at least the same major version of pnpm installed.

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the app:
   ```bash
   pnpm build
   ```

4. The built app will be in the `dist` folder, ready to deploy to your OpenCloud instance.

### 4. Deploy to OpenCloud

Copy the contents of the `dist` folder to your OpenCloud web apps directory. See the [OpenCloud app deployment documentation](https://docs.opencloud.eu/services/web/#web-apps) for more details.

**Important:** Make sure your LLM server is accessible from your browser before using the app!

## Configuration

### Adding a New LLM Configuration

1. Click the Settings button in the sidebar
2. Click "Add Configuration"
3. Fill in the details:
   - **Name**: A friendly name for this configuration
   - **API URL**: The endpoint URL
     - Local Ollama: `http://localhost:11434/v1/chat/completions`
     - Local LM Studio: `http://localhost:1234/v1/chat/completions`
     - Remote endpoint: `https://your-api.com/v1/chat/completions`
   - **API Token**: Authentication token
     - Ollama: `ollama` (or any value)
     - LM Studio: Any value
     - Remote APIs: Your actual API key
   - **Model Name**: The model identifier (e.g., `llama3.2`, `gpt-4`, etc.)
   - **Temperature**: Controls randomness (0.0 = deterministic, 2.0 = very random)
   - **Max Tokens**: Maximum length of responses
   - **System Prompt**: Instructions for how the AI should behave

4. Click "Test connection" to verify it works
5. Set as default if desired

### Managing Conversations

- **New Conversation**: Click the "New Conversation" button in the sidebar
- **Select Conversation**: Click any conversation in the list to view it
- **Delete Conversation**: Click the × button next to a conversation

## Development

### Project Structure

```
local-llm-opencloud/
├── src/
│   ├── components/
│   │   ├── ChatWindow.vue       # Main chat interface
│   │   └── ConfigSettings.vue   # Configuration management
│   ├── services/
│   │   └── api.ts              # API service & local storage
│   ├── views/
│   │   └── Chat.vue            # Main chat view with sidebar
│   └── index.ts                # App entry point
├── public/
│   └── manifest.json           # App manifest
├── package.json
├── vite.config.ts
└── README.md
```

## Architecture

This app is a client-side Vue 3 application that:
- Stores all data in browser localStorage (conversations, messages, configs)
- Communicates directly with LLM servers from the browser
- Supports both local and remote LLM endpoints

**Flow:**
```
Browser (OpenCloud App) → LLM Server (Ollama/LM Studio/Remote API)
```

## Privacy & Security

- All conversation data is stored locally in your browser
- No data is sent to external servers (except your configured LLM endpoint)
- API tokens are stored in browser localStorage
- All communication with the LLM happens directly from your browser

## Troubleshooting

### LLM Connection Failed

**Error:** `Failed to fetch` or API connection errors

**Solutions:**
1. Make sure your LLM server is running
2. Verify the API URL is correct and accessible from your browser
3. For local servers (localhost), ensure they're running on the correct port:
   ```bash
   # Check if Ollama is running
   curl http://localhost:11434/v1/models

   # Check if LM Studio is running
   curl http://localhost:1234/v1/models
   ```
4. For remote APIs, verify your API key is correct
5. Check browser console for detailed error messages

### CORS Issues

If you encounter CORS errors when connecting to local LLM servers:

**For Ollama:**
```bash
# Set the OLLAMA_ORIGINS environment variable before starting Ollama
# Allow all origins (recommended for local use):
export OLLAMA_ORIGINS="*"

# Then start or restart Ollama
ollama serve
```

On Windows (PowerShell):
```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

**For LM Studio:**
1. Open LM Studio
2. Go to Settings → Server
3. Enable "Enable CORS" checkbox
4. Restart the server

**For vLLM:**
```bash
# Add the --allowed-origins flag when starting vLLM
vllm serve <model> --allowed-origins "*"
```

**For Remote APIs:**
Remote HTTPS endpoints usually have CORS already configured. If you encounter CORS errors with a remote endpoint, contact the API provider to enable CORS for your OpenCloud domain.

### CSP (Content Security Policy) Issues

If your OpenCloud instance has strict CSP that blocks connections to your LLM endpoints:

**This app requires CSP configuration to work.** See the [Configure OpenCloud CSP](#2-configure-opencloud-csp-content-security-policy) section above for detailed instructions on how to configure your OpenCloud instance.

If you've already configured CSP and are still having issues:

1. **Verify CSP configuration is loaded**: Check your OpenCloud logs to ensure the CSP configuration file is being read
2. **Restart OpenCloud**: After modifying CSP configuration, restart your OpenCloud instance
3. **Check browser console**: Look for CSP violation errors that will tell you which directive needs to be updated
4. **Use HTTPS endpoints**: Remote HTTPS endpoints are more likely to be allowed by restrictive CSP policies

## License

This project is licensed under the **GPL-2.0** License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- 🐛 [Report bugs](https://github.com/markusbegerow/local-llm-opencloud/issues)
- 💡 [Request features](https://github.com/markusbegerow/local-llm-opencloud/issues)
- 📖 Review LLM server documentation (Ollama, LM Studio)

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly in a development environment
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Submit a pull request

## Acknowledgments

- Ollama team for making local LLMs accessible and easy to use
- OpenCloud team for the excellent platform and development framework
- LM Studio for providing a user-friendly local inference platform
- The open-source LLM community for advancing local AI

## 🙋‍♂️ Get Involved

If you find this useful or have questions:
- ⭐ Star the repo if you find it useful!
- 🐛 [Report bugs](https://github.com/markusbegerow/local-llm-opencloud/issues)
- 💡 [Request features](https://github.com/markusbegerow/local-llm-opencloud/issues)
- 🤝 Contribute improvements via pull requests

## ☕ Support the Project

If you like this project, support further development:

<a href="https://www.linkedin.com/sharing/share-offsite/?url=https://github.com/markusbegerow/local-llm-opencloud" target="_blank">
  <img src="https://img.shields.io/badge/💼-Share%20on%20LinkedIn-blue" />
</a>

[![Buy Me a Coffee](https://img.shields.io/badge/☕-Buy%20me%20a%20coffee-yellow)](https://paypal.me/MarkusBegerow?country.x=DE&locale.x=de_DE)

## 📬 Contact

- 🧑‍💻 [Markus Begerow](https://linkedin.com/in/markusbegerow)
- 💾 [GitHub](https://github.com/markusbegerow)
- ✉️ [Twitter](https://x.com/markusbegerow)

---

**Privacy Notice**: This app operates entirely in your browser by default. No data is sent to external servers unless you explicitly configure a remote API endpoint. All conversation data is stored locally in your browser's localStorage and never leaves your device.

