export default {
  // Settings
  "settings.plugin": "Plugin Settings",
  "settings.storage": "Storage Service",
  "settings.storage.desc": "Select storage service for file uploads",
  "settings.storage.config": "Storage Service Configuration",
  "settings.endpoint": "Endpoint",
  "settings.endpoint.desc": "API Endpoint",
  "settings.accessKeyId": "Access Key ID",
  "settings.accessKeyId.desc": "API Access Key ID",
  "settings.secretAccessKey": "Secret Access Key",
  "settings.secretAccessKey.desc": "API Secret Access Key",
  "settings.region": "Region",
  "settings.region.desc": "Storage Region",
  "settings.bucketName": "Bucket Name",
  "settings.bucketName.desc": "Storage Bucket Name",
  "settings.publicUrl": "Public URL",
  "settings.publicUrl.desc": "Public Access URL",
  "settings.testConnection": "Test Connection",
  "settings.testing": "Testing...",
  "settings.testSuccess": "Connection successful!",
  "settings.testFailed": "Connection failed: {error}",
  "settings.testError": "Error: {error}",

  // Auto Upload Settings
  "settings.autoUpload": "Auto Upload Settings",
  "settings.clipboardAutoUpload": "Clipboard Auto Upload",
  "settings.clipboardAutoUpload.desc":
    "Automatically upload files when pasting from clipboard",
  "settings.dragAutoUpload": "Drag & Drop Auto Upload",
  "settings.dragAutoUpload.desc":
    "Automatically upload files when dragging into Obsidian",
  "settings.fileTypes": "File Types",
  "settings.fileTypes.desc":
    "File types for auto upload, separate multiple types with commas",
  "settings.fileTypes.empty": "Please enter file types",
  "settings.applyNetworkFiles": "Apply to Network Files",
  "settings.applyNetworkFiles.desc":
    "Apply upload rules to network file links in clipboard",
  "settings.language": "Language",
  "settings.language.desc": "Select interface language",

  // Modal
  "modal.storageConfig.title": "Storage Service Not Configured",
  "modal.storageConfig.message":
    "Please configure the storage service before using the file upload feature.",
  "modal.storageConfig.openSettings": "Open Settings",

  // Developer Mode
  "settings.developer": "Developer Mode",
  "settings.developer.name": "Close Developer Mode Menu",
  "settings.developer.desc":
    "Close developer mode menu (auto-disabled on restart)",
  "settings.developer.enabled": "Developer mode enabled",
  "settings.developer.disabled": "Developer mode disabled",
  "settings.developer.debugLogging.name": "Debug Logging",
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
  "error.missingPublicUrl": "Missing public url configuration",

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
  "delete.menuTitle": "Delete Uploaded Files",
  "delete.success": "File deleted successfully: {fileLink}",
  "delete.failed": "File deletion failed: {fileLink} - {error}",
  "delete.error": "Error occurred while deleting file: {fileLink}",
  "delete.unknownError": "Unknown error",
};
