# File Auto Upload

Automatically upload files to cloud storage services when pasting or dragging files into Obsidian.

[中文文档](README_zh-CN.md)

## Features

- **Multi-Cloud Support**: Amazon S3, Cloudflare R2, Alibaba Cloud OSS, Tencent Cloud COS
- **Auto Upload**: Automatically upload files on paste and drag-drop
- **Download to Local**: Download cloud files back to local vault
- **Batch Operations**: Upload/download all files in a document at once
- **Secure Storage**: Encrypted storage for sensitive credentials
- **Progress Tracking**: Real-time upload/download progress in status bar
- **Sync Delete**: Delete cloud files when removing references from editor
- **File Type Filtering**: Configure which file types to auto-upload
- **Multi-language**: English and Chinese interface support

## Supported Storage Services

| Service | Region | Endpoint | Custom Domain |
|---------|--------|----------|---------------|
| Amazon S3 | ✅ | ✅ | ✅ |
| Cloudflare R2 | Auto | ✅ (required) | ✅ (required) |
| Alibaba Cloud OSS | ✅ | ✅ | ✅ |
| Tencent Cloud COS | ✅ | ✅ | ✅ |
| WebDAV | N/A | ✅ (required) | ✅ |

### Amazon S3
Compatible with Amazon S3 and S3-compatible services (MinIO, DigitalOcean Spaces, etc.). Supports multipart uploads for files larger than 5MB with progress tracking.

### Cloudflare R2
Cloudflare's S3-compatible object storage with zero egress fees. Requires endpoint and public domain configuration.

### Alibaba Cloud OSS
Alibaba Cloud Object Storage Service with bucket subdomain URL support.

### Tencent Cloud COS
Tencent Cloud Object Storage with bucket subdomain URL support.

### WebDAV
WebDAV protocol support for self-hosted storage solutions.

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

### Settings Options

| Setting | Description |
|---------|-------------|
| Clipboard Auto Upload | Upload files when pasting from clipboard |
| Drag & Drop Auto Upload | Upload files when dragging into editor |
| File Types | File extensions to auto-upload (e.g., `jpg,png,pdf,mp4`) |
| Language | Interface language (English/Chinese) |

## Usage

### Automatic Upload

When auto-upload is enabled:

1. **Paste**: Copy and paste images or files - they upload automatically
2. **Drag & Drop**: Drag files into the editor - they upload automatically
3. **Screenshots**: Paste screenshots directly - they upload automatically

The plugin replaces local file paths with cloud URLs after successful upload.

### Context Menu Operations

Right-click on selected text in editor:

- **Upload file**: Upload local file references to cloud
- **Download file**: Download cloud files to local vault
- **Delete file**: Delete files from cloud storage

### File Menu Operations

Right-click on a markdown file in file explorer:

- **Upload all files**: Upload all local files referenced in the document
- **Download all files**: Download all cloud files referenced in the document

### Status Bar

The status bar shows real-time progress:
- Upload progress: `2/5: 45%`
- Download progress: `1/3: 80%`

## Security

- All credentials are encrypted using vault-specific keys
- Encryption uses Web Crypto API with PBKDF2 key derivation
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

### Architecture

The plugin follows a modular architecture with clear separation of concerns:

1. **Main Plugin** (`main.ts`): Initializes managers and registers Obsidian events
2. **Configuration Layer** (`settings/`): Manages encrypted settings and user preferences
3. **Storage Layer** (`storage/`): Abstracts cloud storage operations with provider-specific implementations
4. **Event Handling** (`handler/`): Processes user interactions (paste, drop, context menus)
5. **UI Components** (`components/`): Status bar and configuration modals
6. **Utilities** (`utils/`): Shared functionality (logging, encryption, file operations)

**Key Features:**
- **Encryption**: All credentials encrypted using PBKDF2 with vault-specific keys
- **Progress Tracking**: Real-time upload/download progress via status bar
- **Multipart Upload**: Automatic multipart upload for files >5MB with progress callbacks
- **Duplicate Detection**: Optional skip of duplicate file uploads by prefix matching
- **Error Handling**: Comprehensive error handling with user-friendly messages

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

### Download Fails

1. Verify the file URL is accessible
2. Check network connectivity
3. Ensure public domain is correctly configured

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
