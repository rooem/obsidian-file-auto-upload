export default {
  // Settings
  "settings.plugin": "Plugin settings",
  "settings.storage": "Storage service",
  "settings.storage.desc": "Select storage service for file uploads",
  "settings.endpoint": "Endpoint",
  "settings.endpoint.desc": "API endpoint",
  "settings.accessKeyId": "Access key ID",
  "settings.accessKeyId.desc": "Access key ID",
  "settings.secretAccessKey": "Secret access key",
  "settings.secretAccessKey.desc": "Secret access key",
  "settings.username": "Username",
  "settings.username.desc": "Username",
  "settings.password": "Password",
  "settings.password.desc": "Password",
  "settings.basePath": "Base path",
  "settings.basePath.desc": "Base path for uploads (optional)",
  "settings.region": "Region",
  "settings.region.desc": "Storage region",
  "settings.bucketName": "Bucket name",
  "settings.bucketName.desc": "Storage bucket name",
  "settings.publicUrl": "Public access domain",
  "settings.publicUrl.desc": "Public access domain",
  "settings.publicUrl.webdav.desc":
    "Requires authentication by default. Configure a proxy URL for public access (optional)",
  "settings.github.token": "Personal Access Token",
  "settings.github.token.desc":
    "GitHub personal access token with repo permissions",
  "settings.github.repo": "Repository",
  "settings.github.repo.desc": "Repository path (format: owner/repo)",
  "settings.github.branch": "Branch",
  "settings.github.branch.desc": "Branch name (default: main)",
  "settings.github.path": "Upload Path",
  "settings.github.path.desc": "Path in repository for uploads (optional)",
  "settings.github.publicUrl.desc":
    "Custom domain or use github raw url by default (optional)",
  "settings.github.useCdn": "Use cdn acceleration",
  "settings.github.useCdn.desc": "Enable cdn acceleration for github files",
  "settings.github.cdnType": "CDN service",
  "settings.github.cdnType.desc": "Select cdn acceleration service",
  "settings.testConnection": "Test connection",
  "settings.testing": "Testing...",
  "settings.testSuccess": "Connection successful!",
  "settings.testFailed": "Connection failed: {error}",
  "settings.testError": "Error: {error}",

  // Auto Upload Settings
  "settings.autoUpload": "Auto upload settings",
  "settings.clipboardAutoUpload": "Clipboard auto upload",
  "settings.clipboardAutoUpload.desc":
    "Automatically upload files when pasting from clipboard",
  "settings.dragAutoUpload": "Drag & drop auto upload",
  "settings.dragAutoUpload.desc":
    "Automatically upload files when dragging into Obsidian",
  "settings.deleteAfterUpload": "Delete local file after upload",
  "settings.deleteAfterUpload.desc":
    "Automatically delete local file after successful upload",
  "settings.fileTypes": "File types",
  "settings.fileTypes.desc":
    "File types for auto upload, separate multiple types with commas",
  "settings.fileTypes.empty": "Please enter file types",
  "settings.skipDuplicateFiles": "Skip duplicate files",
  "settings.skipDuplicateFiles.desc":
    "Skip uploading duplicate files and reuse existing links",
  "settings.applyNetworkFiles": "Apply to network files",
  "settings.applyNetworkFiles.desc":
    "Apply upload rules to network file links in clipboard",
  "settings.language": "Language",
  "settings.language.desc": "Select interface language",

  // Modal
  "modal.storageConfig.title": "Storage service not configured",
  "modal.storageConfig.message":
    "Please configure the storage service before using the file upload feature.",
  "modal.storageConfig.openSettings": "Open settings",

  // Developer Mode
  "settings.developer": "Developer mode",
  "settings.developer.name": "Close developer mode menu",
  "settings.developer.desc":
    "Close developer mode menu (auto-disabled on restart)",
  "settings.developer.enabled": "Developer mode enabled",
  "settings.developer.disabled": "Developer mode disabled",
  "settings.developer.debugLogging.name": "Debug logging",
  "settings.developer.debugLogging.desc": "Enable debug log output",

  // Notices
  "notice.queueLost":
    "Plugin closed with unfinished tasks. {count} files may be lost.",

  // Connection Config Errors
  "error.missingEndpoint": "Missing endpoint configuration",
  "error.missingRegion": "Missing region configuration",
  "error.missingAccessKeyId": "Missing access key ID configuration",
  "error.missingSecretAccessKey": "Missing secret access key configuration",
  "error.missingBucketName": "Missing bucket name configuration",
  "error.missingPublicUrl": "Missing public URL configuration",
  "error.missingUsername": "Missing username configuration",
  "error.missingPassword": "Missing password configuration",

  // Operation Errors
  "error.uploadError": "Upload error",
  "error.uploadFailed": "Upload failed",
  "error.deleteError": "Delete error",
  "error.deleteFailed": "Delete failed",
  "error.fileDeletionFailed": "File deletion failed",
  "error.fileExistenceCheckFailed": "File existence check failed",
  "error.getFileInfoFailed": "Get file info failed",

  // Upload Progress
  "upload.progressing": "Progressing",
  "upload.progrefailed": "Progress failed",
  "upload.uploading": "Uploading",
  "upload.failed": "Upload failed",

  // Delete Operations
  "delete.menuTitle": "Delete file(file auto upload)",
  "delete.success": "File deleted successfully: {fileLink}",
  "delete.failed": "Failed to delete file: {fileLink} - {error}",
  "delete.error": "Error deleting file: {fileLink}",
  "delete.unknownError": "Unknown error",
  "delete.fileNotFound": "Remote file not found, link cleaned: {key}",

  // Upload Local File
  "upload.localFile": "Upload file(file auto upload)",
  "upload.allLocalFiles": "Upload all files(file auto upload)",
  "upload.noFiles": "No uploadable files found",
  "upload.folderFiles": "Upload files(file auto upload)",
  "upload.folderScanTitle": "File Scan Result",
  "upload.folderScanResult": "Found {docs} documents, {files} uploadable files",
  "upload.folderUploadBtn": "Upload",
  "upload.folderScanClose": "Close",
  "upload.scanning": "Scanning",

  // Download
  "download.menuTitle": "Download file(file auto upload)",
  "download.allMenuTitle": "Download all files(file auto upload)",
  "download.allFromFolder": "Download all files from folder(file auto upload)",
  "download.progressing": "Downloading",
  "download.noFiles": "No downloadable files found",
  "download.foundFiles": "Found {count} downloadable files",
  "download.success": "File downloaded: {fileName}",
  "download.failed": "Download failed: {error}",
  "download.folderScanTitle": "File Scan Result",
  "download.folderScanResult":
    "Found {docs} documents, {files} downloadable files",
  "download.folderDownloadBtn": "Download",
  "download.folderScanClose": "Close",
  "download.scanning": "Scanning",

  // Status Bar
  "statusBar.uploading": "{uploaded}/{total}: {progress}%",
  "statusBar.downloading": "{downloaded}/{total}: {progress}%",
  "statusBar.uploadingDetailed": "{uploaded}/{total}: {progress}% ({speed}, {eta})",
  "statusBar.downloadingDetailed": "{downloaded}/{total}: {progress}% ({speed}, {eta})",
  
  // Cancel
  "cancel": "Cancel",
  "cancelling": "Cancelling..."
};