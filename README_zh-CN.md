# File Auto Upload

在 Obsidian 中粘贴或拖拽文件时，自动上传到云存储服务。

[English](README.md)

## 功能特性

- **多云存储支持**：Amazon S3、Cloudflare R2、阿里云 OSS、腾讯云 COS
- **自动上传**：粘贴和拖拽文件时自动上传
- **下载到本地**：将云端文件下载回本地仓库
- **批量操作**：一键上传/下载文档中的所有文件
- **安全存储**：敏感凭证加密存储
- **进度跟踪**：状态栏实时显示上传/下载进度
- **同步删除**：从编辑器删除引用时同步删除云端文件
- **文件类型过滤**：配置需要自动上传的文件类型
- **多语言**：支持中英文界面

## 支持的存储服务

| 服务 | 区域 | 端点 | 自定义域名 |
|------|------|------|-----------|
| Amazon S3 | ✅ | ✅ (可选) | ✅ |
| Cloudflare R2 | 账户 ID | 自动 | ✅ |
| 阿里云 OSS | ✅ | ✅ (可选) | ✅ |
| 腾讯云 COS | ✅ | 自动 | ✅ |

### Amazon S3
兼容 Amazon S3 和 S3 协议的服务（MinIO、DigitalOcean Spaces 等）

### Cloudflare R2
Cloudflare 的 S3 兼容对象存储，零出口费用。

### 阿里云 OSS
阿里云对象存储服务。

### 腾讯云 COS
腾讯云对象存储。

## 安装方法

### 从 Obsidian 社区插件安装

1. 打开 设置 → 第三方插件
2. 关闭安全模式
3. 浏览并搜索 "File Auto Upload"
4. 安装并启用插件

### 手动安装

1. 从 [GitHub Releases](https://github.com/rooem/obsidian-file-auto-upload/releases) 下载最新版本
2. 解压文件到 `{vault}/.obsidian/plugins/file-auto-upload/`
3. 重新加载 Obsidian
4. 在 设置 → 第三方插件 中启用插件

## 配置说明

1. 打开插件设置
2. 选择存储服务类型
3. 输入服务凭证
4. 点击"测试连接"验证配置
5. 根据需要启用自动上传功能

### 设置选项

| 设置 | 说明 |
|------|------|
| 剪贴板自动上传 | 从剪贴板粘贴文件时自动上传 |
| 拖拽自动上传 | 拖拽文件到编辑器时自动上传 |
| 文件类型 | 需要自动上传的文件扩展名（如：`jpg,png,pdf,mp4`） |
| 语言 | 界面语言（中文/英文） |

## 使用方法

### 自动上传

启用自动上传后：

1. **粘贴**：复制并粘贴图片或文件 - 自动上传
2. **拖拽**：拖拽文件到编辑器 - 自动上传
3. **截图**：直接粘贴截图 - 自动上传

插件会在上传成功后自动将本地文件路径替换为云端 URL。

### 右键菜单操作

在编辑器中选中文本后右键：

- **上传文件**：将本地文件引用上传到云端
- **下载文件**：将云端文件下载到本地仓库
- **删除文件**：从云存储中删除文件

### 文件菜单操作

在文件浏览器中右键点击 Markdown 文件：

- **上传所有文件**：上传文档中引用的所有本地文件
- **下载所有文件**：下载文档中引用的所有云端文件

### 状态栏

状态栏显示实时进度：
- 上传进度：`2/5: 45%`
- 下载进度：`1/3: 80%`

## 安全说明

- 所有凭证使用仓库特定密钥加密
- 加密使用 Web Crypto API 和 PBKDF2 密钥派生
- 不收集或传输任何数据到第三方
- 建议使用具有最小必需权限的 API 密钥

## 开发

### 环境要求

- Node.js 18+
- pnpm 8+

### 开发步骤

```bash
# 安装依赖
pnpm install

# 开发模式（监听）
pnpm run dev

# 构建生产版本
pnpm run build

# 代码检查
pnpm run lint

# 代码格式化
pnpm run format
```

### 项目结构

```
src/
├── main.ts              # 插件入口
├── components/          # UI 组件（状态栏、弹窗）
├── handler/             # 事件处理器
│   ├── UploadEventHandler.ts    # 处理上传事件
│   ├── DownloadHandler.ts       # 处理下载事件
│   ├── DeleteEventHandler.ts    # 处理删除事件
│   └── EventHandlerManager.ts   # 协调所有处理器
├── uploader/            # 存储提供商实现
│   ├── UploaderManager.ts       # 上传服务管理器
│   └── providers/               # S3、R2、OSS、COS 上传器
├── settings/            # 配置管理
├── utils/               # 工具函数（日志、加密、文件工具）
├── i18n/                # 国际化（en、zh-CN）
└── types/               # TypeScript 类型定义
```

## 故障排除

### 上传失败

1. 在设置中验证凭证
2. 点击"测试连接"检查配置
3. 检查存储桶权限和 CORS 设置
4. 查看控制台日志（Ctrl+Shift+I）

### 文件未自动上传

1. 确保在设置中启用了自动上传
2. 检查文件类型是否在允许列表中
3. 验证存储服务已配置
4. 检查错误通知

### 下载失败

1. 验证文件 URL 是否可访问
2. 检查网络连接
3. 确保公共域名配置正确

## 贡献

欢迎贡献！请：

1. Fork 仓库
2. 创建功能分支
3. 进行更改
4. 运行代码检查和格式化
5. 提交 Pull Request

## 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 支持

- 报告问题：[GitHub Issues](https://github.com/rooem/obsidian-file-auto-upload/issues)
- 功能请求：[GitHub Discussions](https://github.com/rooem/obsidian-file-auto-upload/discussions)

---

**注意**：使用前请确保了解云存储提供商的定价和使用限制。
