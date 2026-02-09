# LawyerOS3

案件管理系统（React + Vite），已支持 Supabase 实时同步。

## 1. 安装依赖

```bash
npm install
```

## 2. 配置 Supabase

1. 在 Supabase 创建项目。
2. 进入 SQL Editor，执行 `supabase/schema.sql`。
3. 在项目根目录复制环境变量文件并填入你的项目信息：

```bash
cp .env.example .env.local
```

`.env.local` 示例：

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4. 在 Supabase 控制台开启 Realtime：
- `Database` -> `Replication` -> 将 `cases` 和 `parties` 表加入 realtime publication。

## 3. 启动项目

```bash
npm run dev
```

## 4. 同步行为说明

- 配置了 Supabase：
  - 手机端和电脑端改动会实时同步。
  - 侧边栏底部显示同步状态和最后同步时间。
- 未配置 Supabase：
  - 自动退回本地模式（localStorage / 原有 `/api/data`）。

## 5. 数据备份

仍可通过界面中的 `Backup Data` 导出 JSON 备份。
