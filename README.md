# File Auto Upload Plugin for Obsidian

一个功能强大的 Obsidian 插件，支持自动将文件上传到多种云存储服务。

## ✨ 功能特性

- 🚀 **多云存储支持**: 支持 Amazon S3、阿里云 OSS、腾讯云 COS、Cloudflare R2 等主流云存储服务
- 🔄 **自动上传**: 拖拽、粘贴文件时自动上传到云端
- 🔐 **安全加密**: 支持敏感信息加密存储
- 📊 **上传进度**: 实时显示上传进度和状态
- 🎯 **灵活配置**: 每个存储服务独立配置，支持多账号
- 🗑️ **同步删除**: 删除本地文件时可选择同时删除云端文件
- ⚡ **并发控制**: 智能控制并发上传数量，避免资源占用过高

## 📦 安装方法

### 从 Obsidian 社区插件安装（推荐）

1. 打开 Obsidian 设置
2. 进入「第三方插件」
3. 关闭「安全模式」
4. 点击「浏览」搜索 "File Auto Upload"
5. 点击安装并启用插件

### 手动安装

1. 从 [Releases](https://github.com/yourusername/file-auto-upload/releases) 下载最新版本
2. 解压到 Obsidian 插件目录：`{vault}/.obsidian/plugins/file-auto-upload/`
3. 重启 Obsidian
4. 在设置中启用插件

## 🔧 配置说明

### 支持的存储服务

#### Amazon S3
- 支持标准 S3 和兼容 S3 协议的服务
- 需要配置：Access Key、Secret Key、Bucket、Region、Endpoint（可选）

#### 阿里云 OSS
- 支持阿里云对象存储服务
- 需要配置：Access Key、Secret Key、Bucket、Region、Endpoint（可选）

#### 腾讯云 COS
- 支持腾讯云对象存储服务
- 需要配置：Secret ID、Secret Key、Bucket、Region

#### Cloudflare R2
- 支持 Cloudflare R2 存储服务
- 需要配置：Access Key、Secret Key、Bucket、Account ID

### 基本设置

1. 打开插件设置
2. 选择存储服务类型
3. 填写对应的配置信息
4. 启用自动上传功能
5. 配置其他选项（可选）

### 高级选项

- **自定义路径前缀**: 为上传的文件添加路径前缀
- **自定义域名**: 使用自定义域名访问上传的文件
- **并发上传数**: 控制同时上传的文件数量（默认 3）
- **同步删除**: 删除本地文件时同时删除云端文件

## 📖 使用方法

### 自动上传

启用自动上传后，以下操作会自动触发上传：

1. **拖拽文件**: 将文件拖拽到编辑器中
2. **粘贴文件**: 从剪贴板粘贴图片或文件
3. **粘贴截图**: 直接粘贴截图

上传成功后，插件会自动将本地文件路径替换为云端 URL。

### 手动操作

- **测试连接**: 在设置页面点击「测试连接」验证配置是否正确
- **查看日志**: 在设置页面查看上传历史和错误日志

## 🔒 安全说明

- 所有敏感信息（如 Access Key、Secret Key）都经过加密存储
- 插件不会收集或上传任何用户数据
- 建议使用具有最小权限的 API 密钥

## 🛠️ 开发

### 环境要求

- Node.js 18+
- pnpm 8+

### 开发步骤

```bash
# 安装依赖
pnpm install

# 开发模式（自动编译）
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
file-auto-upload/
├── src/
│   ├── components/      # UI 组件
│   ├── handler/         # 事件处理器
│   ├── manager/         # 管理器
│   ├── uploader/        # 上传器实现
│   ├── utils/           # 工具函数
│   └── main.ts          # 插件入口
├── manifest.json        # 插件清单
├── package.json         # 依赖配置
└── README.md           # 说明文档
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

在提交 PR 前，请确保：
- 代码通过 ESLint 检查
- 代码已格式化（使用 Prettier）
- 添加了必要的测试

## 📝 更新日志

### v1.0.0 (2024-12-01)

- 🎉 初始版本发布
- ✅ 支持 Amazon S3、阿里云 OSS、腾讯云 COS、Cloudflare R2
- ✅ 自动上传功能
- ✅ 加密存储敏感信息
- ✅ 上传进度显示
- ✅ 同步删除功能

## 📄 许可证

[MIT License](LICENSE)

## 💬 支持

如果你觉得这个插件有用，欢迎：

- ⭐ 给项目点个 Star
- 🐛 报告 Bug 或提出建议
- 💡 贡献代码或文档

---

**注意**: 使用前请确保你有合适的云存储服务账号，并了解相关的费用和使用限制。
