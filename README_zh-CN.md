# File Auto Upload

在 Obsidian 中粘贴或拖拽文件时，自动上传到云存储服务。

## 功能特性

- **多云存储支持**：Amazon S3、Cloudflare R2、阿里云 OSS、腾讯云 COS
- **自动上传**：粘贴和拖拽文件时自动上传
- **安全存储**：敏感凭证加密存储
- **进度跟踪**：实时显示上传进度
- **同步删除**：删除本地引用时可选择删除云端文件
- **文件类型过滤**：配置需要自动上传的文件类型

## 支持的存储服务

### Amazon S3
兼容 Amazon S3 和 S3 协议的服务（MinIO、DigitalOcean Spaces 等）

**必需配置：**
- Access Key ID（访问密钥 ID）
- Secret Access Key（访问密钥）
- Bucket Name（存储桶名称）
- Region（区域）
- Endpoint（端点，可选）
- Public URL（公共 URL，可选）

### Cloudflare R2
Cloudflare 的 S3 兼容对象存储

**必需配置：**
- Access Key ID（访问密钥 ID）
- Secret Access Key（访问密钥）
- Bucket Name（存储桶名称）
- Account ID（账户 ID）
- Public URL（公共 URL，可选）

### 阿里云 OSS
阿里云对象存储服务

**必需配置：**
- Access Key ID（访问密钥 ID）
- Secret Access Key（访问密钥）
- Bucket Name（存储桶名称）
- Region（区域）
- Endpoint（端点，可选）
- Public URL（公共 URL，可选）

### 腾讯云 COS
腾讯云对象存储

**必需配置：**
- Secret ID（密钥 ID）
- Secret Key（密钥）
- Bucket Name（存储桶名称）
- Region（区域）
- Public URL（公共 URL，可选）

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

### 自动上传设置

- **剪贴板自动上传**：从剪贴板粘贴文件时自动上传
- **拖拽自动上传**：拖拽文件到编辑器时自动上传
- **文件类型**：需要自动上传的文件扩展名列表，用逗号分隔（如：`jpg,png,pdf`）

## 使用方法

### 自动上传

启用自动上传后：

1. **粘贴**：复制并粘贴图片或文件 - 自动上传
2. **拖拽**：拖拽文件到编辑器 - 自动上传
3. **截图**：直接粘贴截图 - 自动上传

插件会在上传成功后自动将本地文件路径替换为云端 URL。

### 手动操作

- **测试连接**：在设置中验证存储配置
- **删除云端文件**：右键点击已上传的文件链接，可从云存储中删除

## 安全说明

- 所有凭证使用 Obsidian 安全存储加密
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
├── components/      # UI 组件和设置
├── handler/         # 事件处理器（粘贴、拖拽、删除）
├── manager/         # 服务管理器（配置、上传、事件）
├── uploader/        # 存储提供商实现
│   └── providers/   # S3、R2、OSS、COS 上传器
├── utils/           # 工具函数（日志、加密）
├── i18n/            # 国际化
└── main.ts          # 插件入口
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
