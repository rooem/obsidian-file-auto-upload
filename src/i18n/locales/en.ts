export default {
  // Settings
  "settings.plugin": "Plugin settings",
  "settings.storage": "Storage service",
  "settings.storage.desc": "Select storage service for file uploads",
  "settings.storage.config": "Storage service configuration",
  "settings.endpoint": "Endpoint",
  "settings.endpoint.desc": "API endpoint",
  "settings.accessKeyId": "Access key ID",
  "settings.accessKeyId.desc": "API access key ID",
  "settings.secretAccessKey": "Secret access key",
  "settings.secretAccessKey.desc": "API secret access key",
  "settings.region": "Region",
  "settings.region.desc": "Storage region",
  "settings.bucketName": "Bucket name",
  "settings.bucketName.desc": "Storage bucket name",
  "settings.publicUrl": "Public URL",
  "settings.publicUrl.desc": "Public access URL",
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
  "settings.fileTypes": "File types",
  "settings.fileTypes.desc":
    "File types for auto upload, separate multiple types with commas",
  "settings.fileTypes.empty": "Please enter file types",
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
  "delete.menuTitle": "Delete uploaded files",
  "delete.success": "File deleted successfully: {fileLink}",
  "delete.failed": "File deletion failed: {fileLink} - {error}",
  "delete.error": "Error occurred while deleting file: {fileLink}",
  "delete.unknownError": "Unknown error",
};
