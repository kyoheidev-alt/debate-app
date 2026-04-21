# Supabase Migrations

このフォルダには PostgreSQL のマイグレーションが含まれています。新規プロジェクト向けに統合済みで、適用は **2 ファイルだけ** です。

| ファイル                                     | 内容                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`migrations/0001_init.sql`](migrations/0001_init.sql) | `profiles` / `rooms` / `messages` / `stances` / `notifications` テーブル、`handle_new_user` トリガ、Realtime publication |
| [`migrations/0002_rls.sql`](migrations/0002_rls.sql)   | `is_app_admin()` / `is_chair_of()` などのヘルパー関数と、全テーブルの RLS ポリシー        |

## 適用方法

### Supabase CLI を使う場合

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

### Supabase ダッシュボードから実行する場合

1. <https://supabase.com/dashboard> でプロジェクトを開く
2. 左メニュー「SQL Editor」を開く
3. 以下の順序でファイルの中身を貼り付けて実行する
   1. `migrations/0001_init.sql`
   2. `migrations/0002_rls.sql`

## 認証設定

認証は **2 系統** あります（詳細は [`../README.md`](../README.md) の「認証方針」を参照）：

| 区分 | 入力 | 内部表現 |
| ---- | ---- | -------- |
| 議長 / アプリ管理者 | 実メール + パスワード | そのまま |
| 学生 | 学籍番号のみ | 擬似メール `<学籍番号>@debate.local` |

### Supabase ダッシュボード設定

Authentication → Providers → Email で **Confirm email** を以下のいずれかに設定:

- **ON**（推奨・本番）
  議長の本人確認・パスワードリセットが正しく機能。SMTP の設定が必要。
- **OFF**（開発用）
  SMTP を設定していない場合に楽。議長は signUp 直後に即ログインできます。

学生用の擬似メールは Service Role の `admin.createUser({ email_confirm: true })` で作るため、この設定の影響を受けません。

## 初回アプリ管理者の作成

1. アプリの `/signup` で **任意の実メール** + パスワードでアカウントを登録
   （Confirm email ON の場合は受信メールのリンクをクリックして有効化）
2. Supabase SQL Editor で次を実行

```sql
update public.profiles
set role = 'app_admin'
where login_id = '<登録に使ったメールアドレス>';
```

> 議長アカウントは登録時のメールアドレスがそのまま `profiles.login_id` に入ります。

3. 以後は `/sys/login` から **メールアドレス + パスワード** でアプリ管理者ダッシュボードへ。

## トラブルシューティング

### Realtime が動かない（メッセージがリロードしないと反映されない）

Supabase Logs → Realtime に `UnableToConnectToProject: Realtime was unable to connect to the project database` が大量に出る場合、`supabase_realtime_admin` ロールが LOGIN 権限を失っています。

**Dashboard の SQL Editor**（postgres スーパーユーザー権限）で以下を実行してください。

```sql
alter role supabase_realtime_admin with login;
```

実行後 10〜30 秒で Realtime サービスが再接続し、postgres_changes が配信されるようになります。

> このロールは reserved role なので、通常のマイグレーション（`service_role` 経由）からは ALTER できません。Dashboard の SQL Editor から手動で行う必要があります。

### Realtime 接続後もイベントが届かない

`supabase_realtime_admin` には `public` スキーマへの USAGE と SELECT が必要です。`drop schema public cascade` で消えることがあるため、`0001_init.sql` の grants 節で再付与しています。マイグレーションを再適用すれば復活します。

