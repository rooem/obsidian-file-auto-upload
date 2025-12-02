# File Auto Upload

Automatically upload files to cloud storage services when pasting or dragging files into Obsidian.

## Features

- **Multi-Cloud Support**: Amazon S3, Cloudflare R2, Alibaba Cloud OSS, Tencent Cloud COS
- **Auto Upload**: Automatically upload files on paste and drag-drop
- **Secure Storage**: Encrypted storage for sensitive credentials
- **Progress Tracking**: Real-time upload progress indicators
- **Sync Delete**: Optionally delete cloud files when removing local references
- **File Type Filtering**: Configure which file types to auto-upload

## Supported Storage Services

### Amazon S3
Compatible with Amazon S3 and S3-compatible services (MinIO, DigitalOcean Spaces, etc.)

**Required Configuration:**
- Access Key ID
- Secret Access Key
- Bucket Name
- Region
- Endpoint (optional)
- Public URL (optional)

### Cloudflare R2
Cloudflare's S3-compatible object storage

**Required Configuration:**
- Access Key ID
- Secret Access Key
- Bucket Name
- Account ID
- Public URL (optional)

### Alibaba Cloud OSS
Alibaba Cloud Object Storage Service

**Required Configuration:**
- Access Key ID
- Secret Access Key
- Bucket Name
- Region
- Endpoint (optional)
- Public URL (optional)

### Tencent Cloud COS
Tencent Cloud Object Storage

**Required Configuration:**
- Secret ID
- Secret Key
- Bucket Name
- Region
- Public URL (optional)

## Installation

### From Obsidian Community Plugins

1. Open Settings → Community Plugins
2. Disable Safe Mode
3. Browse and search for "File Auto Upload"
4. Install and enable the plugin

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/rooem/obsidian-file-auto-upload/releases)
2. Extract files to `{vault}/.obsidian/plugins/file-auto-upload/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Configuration

1. Open plugin settings
2. Select your storage service type
3. Enter your service credentials
4. Click "Test Connection" to verify configuration
5. Enable auto-upload features as needed

### Auto Upload Settings

- **Clipboard Auto Upload**: Upload files when pasting from clipboard
- **Drag & Drop Auto Upload**: Upload files when dragging into editor
- **File Types**: Comma-separated list of file extensions to auto-upload (e.g., `jpg,png,pdf`)


## Usage

### Automatic Upload

When auto-upload is enabled:

1. **Paste**: Copy and paste images or files - they'll upload automatically
2. **Drag & Drop**: Drag files into the editor - they'll upload automatically
3. **Screenshots**: Paste screenshots directly - they'll upload automatically

The plugin automatically replaces local file paths with cloud URLs after successful upload.

### Manual Operations

- **Test Connection**: Verify your storage configuration in settings
- **Delete Cloud Files**: Right-click on uploaded file links to delete from cloud storage

## Security

- All credentials are encrypted using Obsidian's secure storage
- No data is collected or transmitted to third parties
- Use API keys with minimal required permissions

## Development

### Requirements

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Install dependencies
pnpm install

# Development mode (watch)
pnpm run dev

# Build production
pnpm run build

# Lint code
pnpm run lint

# Format code
pnpm run format
```

### Project Structure

```
src/
├── components/      # UI components and settings
├── handler/         # Event handlers (paste, drop, delete)
├── manager/         # Service managers (config, upload, events)
├── uploader/        # Storage provider implementations
│   └── providers/   # S3, R2, OSS, COS uploaders
├── utils/           # Utilities (logger, encryption)
├── i18n/            # Internationalization
└── main.ts          # Plugin entry point
```

## Troubleshooting

### Upload Fails

1. Verify credentials in settings
2. Click "Test Connection" to check configuration
3. Check bucket permissions and CORS settings
4. Review console logs (Ctrl+Shift+I)

### Files Not Auto-Uploading

1. Ensure auto-upload is enabled in settings
2. Check file type is in allowed list
3. Verify storage service is configured
4. Check for error notifications

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and formatting
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- Report bugs: [GitHub Issues](https://github.com/rooem/obsidian-file-auto-upload/issues)
- Feature requests: [GitHub Discussions](https://github.com/rooem/obsidian-file-auto-upload/discussions)

---

**Note**: Ensure you understand your cloud storage provider's pricing and usage limits before use.
