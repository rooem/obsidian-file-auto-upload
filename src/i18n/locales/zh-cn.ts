export default {
  // Settings
  "settings.plugin": "插件设置",
  "settings.storage": "存储服务",
  "settings.storage.desc": "选择文件上传的存储服务",
  "settings.endpoint": "接入点",
  "settings.endpoint.desc": "Endpoint",
  "settings.accessKeyId": "访问密钥ID",
  "settings.accessKeyId.desc": "Access key ID",
  "settings.secretAccessKey": "访问密钥",
  "settings.secretAccessKey.desc": "Secret access key",
  "settings.username": "用户名",
  "settings.username.desc": "用户名",
  "settings.password": "密码",
  "settings.password.desc": "密码",
  "settings.basePath": "基础路径",
  "settings.basePath.desc": "上传的基础路径（可选）",
  "settings.region": "区域",
  "settings.region.desc": "Region",
  "settings.bucketName": "存储桶",
  "settings.bucketName.desc": "Bucket name",
  "settings.publicUrl": "公共访问域名",
  "settings.publicUrl.desc": "Public Domain",
  "settings.publicUrl.webdav.desc":
    "默认需要身份鉴权，请配置支持公开访问的代理地址（可选）",
  "settings.github.token": "个人访问令牌",
  "settings.github.token.desc": "具有 repo 权限的 GitHub 个人访问令牌",
  "settings.github.repo": "仓库",
  "settings.github.repo.desc": "仓库路径（格式：owner/repo）",
  "settings.github.branch": "分支",
  "settings.github.branch.desc": "分支名称（默认：main）",
  "settings.github.path": "上传路径",
  "settings.github.path.desc": "仓库中的上传目录（可选）",
  "settings.github.publicUrl.desc": "自定义域名，默认使用 jsdelivr CDN",
  "settings.testConnection": "测试连接",
  "settings.testing": "测试中...",
  "settings.testSuccess": "连接成功！",
  "settings.testFailed": "连接失败：{error}",
  "settings.testError": "错误：{error}",

  // Auto Upload Settings
  "settings.autoUpload": "自动上传设置",
  "settings.clipboardAutoUpload": "剪贴板自动上传",
  "settings.clipboardAutoUpload.desc": "从剪贴板粘贴时自动上传文件",
  "settings.dragAutoUpload": "拖放自动上传",
  "settings.dragAutoUpload.desc": "拖动文件到 Obsidian 时自动上传",
  "settings.deleteAfterUpload": "上传后删除仓库文件",
  "settings.deleteAfterUpload.desc": "上传完成后自动删除仓库中的本地文件",
  "settings.fileTypes": "文件类型",
  "settings.fileTypes.desc": "自动上传的文件类型，多个类型用逗号分隔",
  "settings.fileTypes.empty": "请输入文件类型",
  "settings.skipDuplicateFiles": "跳过重复文件",
  "settings.skipDuplicateFiles.desc":
    "同一文件不重复上传，直接复用已上传的链接",
  "settings.applyNetworkFiles": "应用于网络文件",
  "settings.applyNetworkFiles.desc": "将上传规则应用于剪贴板中的网络文件链接",
  "settings.language": "语言",
  "settings.language.desc": "选择界面语言",

  // Modal
  "modal.storageConfig.title": "存储服务未配置",
  "modal.storageConfig.message": "使用文件上传功能前，请先配置存储服务。",
  "modal.storageConfig.openSettings": "打开设置",

  // Developer Mode
  "settings.developer": "开发者模式",
  "settings.developer.name": "关闭开发者模式菜单",
  "settings.developer.desc": "关闭开发者模式菜单（重启后自动关闭）",
  "settings.developer.enabled": "开发者模式已开启",
  "settings.developer.disabled": "开发者模式已关闭",
  "settings.developer.debugLogging.name": "调试日志",
  "settings.developer.debugLogging.desc": "启用调试日志输出",

  // Notices
  "notice.queueLost": "插件关闭时有未完成的任务。{count} 个文件可能丢失。",

  // Connection Config Errors
  "error.missingEndpoint": "缺少端点配置",
  "error.missingRegion": "缺少区域配置",
  "error.missingAccessKeyId": "缺少访问密钥 ID 配置",
  "error.missingSecretAccessKey": "缺少密钥配置",
  "error.missingBucketName": "缺少存储桶名称配置",
  "error.missingPublicUrl": "缺少公共 URL 配置",
  "error.missingUsername": "缺少用户名配置",
  "error.missingPassword": "缺少密码配置",

  // Operation Errors
  "error.uploadError": "上传错误",
  "error.uploadFailed": "上传失败",
  "error.deleteError": "删除错误",
  "error.deleteFailed": "删除失败",
  "error.fileDeletionFailed": "文件删除失败",
  "error.fileExistenceCheckFailed": "文件存在性检查失败",
  "error.getFileInfoFailed": "获取文件信息失败",

  // Upload Progress
  "upload.progressing": "处理中",
  "upload.progrefailed": "处理失败",
  "upload.uploading": "上传中",
  "upload.failed": "上传失败",

  // Delete Operations
  "delete.menuTitle": "删除文件（file auto upload）",
  "delete.success": "文件删除成功：{fileLink}",
  "delete.failed": "文件删除失败：{fileLink} - {error}",
  "delete.error": "删除文件时发生错误：{fileLink}",
  "delete.unknownError": "未知错误",

  // Upload Local File
  "upload.localFile": "上传文件（file auto upload）",
  "upload.allLocalFiles": "上传所有文件（file auto upload）",
  "upload.noFiles": "未发现可上传的文件",

  // Download
  "download.menuTitle": "下载文件（file auto upload）",
  "download.allMenuTitle": "下载所有文件（file auto upload）",
  "download.progressing": "下载中",
  "download.noFiles": "未发现可下载的文件",
  "download.success": "文件已下载：{fileName}",
  "download.failed": "下载失败：{error}",

  // Status Bar
  "statusBar.uploading": "{uploaded}/{total}: {progress}%",
  "statusBar.downloading": "{downloaded}/{total}: {progress}%",
};
