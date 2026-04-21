# 匿名ディベートチャット

匿名（ニックネーム）で参加できる、リアルタイムのディベートチャットルーム。

## 特徴

- 誰でも `/signup` から **メールアドレス + パスワード** で自由に登録（Supabase標準フロー / メール確認・パスワードリセット対応）
- 登録後すぐにルームを作成して **議長** になれる
- 議長は CSV / 単票入力で参加ユーザーを登録、強制退出、テーマ編集、実名表示切替、重要意見ピックアップが可能
- **学生はパスワード不要・メール不要**：トップで「ルームID」を入力 → `/r/[id]/enter` で **学籍番号のみ** を入力 → 本人確認ダイアログ → そのまま入室
- 学生のセッションは Supabase Auth 経由で確立されるが、再訪問時のため `(roomID, 学籍番号)` を localStorage に保存しフォームを自動入力
- 未登録の学籍番号で入室を試みると、議長の管理画面にRealtimeでベル通知＋ポップアップ表示。その場で登録ボタンも提供
- 賛成派は左／反対派は右に並ぶ DM スタイルチャット
- 賛成・反対の人数比をリアルタイム表示するバロメーター（扇形グラフ）
- 重要意見は Twitter 風リプライツリーで議論を深堀り
- アプリ管理者専用の `/sys` URL で、全ルーム・全ユーザーの俯瞰と管理

## ロール体系

| ロール             | 表現                                | できること                                        |
| ------------------ | ----------------------------------- | ------------------------------------------------- |
| 一般ユーザー       | `profiles.role = 'user'`            | チャット参加・立場切替・重要意見への返信          |
| 議長 (per-room)    | `rooms.chair_id = auth.uid()`       | そのルームの全管理（テーマ・参加者・重要意見など）|
| アプリ管理者       | `profiles.role = 'app_admin'`       | 全ルーム/全ユーザーの操作 + ロール付与            |

## URL構成

| URL                          | 用途                                                  | アクセス可能者              |
| ---------------------------- | ----------------------------------------------------- | --------------------------- |
| `/`                          | LP（ルームID入力）                                    | 誰でも                      |
| `/r/[id]/enter`              | 学生用 入室画面（学籍番号入力 + 本人確認ダイアログ）  | 誰でも                      |
| `/r/[id]/setup-nickname`     | 学生 初回入室時のニックネーム設定                     | 入室済の学生                |
| `/login`                     | 議長ユーザーログイン                                  | 誰でも                      |
| `/signup`                    | 議長セルフサインアップ                                | 誰でも                      |
| `/dashboard`                 | 議長ホーム（議長ルーム一覧 / ルーム作成 / 入室）      | 認証済                      |
| `/rooms/[id]`                | チャット                                              | メンバー / 議長 / app_admin |
| `/rooms/[id]/manage`         | ルーム管理（議長専用 / 通知ベル）                     | 議長 / app_admin            |
| `/sys/login`                 | アプリ管理者ログイン（URL 分離）                       | 誰でも                      |
| `/sys`                       | アプリ管理者ダッシュボード                            | app_admin のみ              |

## 技術スタック

| Layer        | Tech                                                         |
| ------------ | ------------------------------------------------------------ |
| Framework    | Next.js 15 (App Router) + TypeScript                         |
| UI           | TailwindCSS                                                  |
| DB / Auth    | Supabase (PostgreSQL + Auth + Realtime + RLS)                |
| Realtime     | `@supabase/supabase-js` postgres_changes ([Realtime](https://supabase.com/docs/guides/realtime)) |
| Cookie / SSR | `@supabase/ssr`                                              |
| Chart        | Recharts                                                     |
| CSV          | papaparse                                                    |
| Hosting      | Vercel (frontend) + Supabase (managed)                       |

---

## セットアップ

### 1. リポジトリの取得と依存インストール

```powershell
git clone <this-repo>
cd debate-app
npm install
```

### 2. Supabase プロジェクトの準備

1. <https://supabase.com> でプロジェクトを作成
2. 「Project Settings → API」から以下を控える
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**サーバ専用・公開禁止**)
3. SQL Editor で以下の順番で実行
   1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — スキーマ + トリガ + Realtime
   2. [`supabase/migrations/0002_rls.sql`](supabase/migrations/0002_rls.sql) — ヘルパー関数 + RLS
4. **Authentication → Providers → Email** の設定
   - **Confirm email** を ON 推奨（議長の本人確認とパスワードリセットが正しく機能する）
   - SMTP を設定していない場合は OFF にしておくと開発が楽（議長は signUp 直後に即ログイン可能になります）
   - 学生用の擬似メール `<学籍番号>@debate.local` は Service Role 経由で `email_confirm: true` を付けて作成するため、Confirm email 設定の影響を受けません

### 3. 環境変数を設定

`.env.local` をプロジェクトルートに作成（`.env.local.example` をコピー）:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 4. 開発サーバ起動

```powershell
npm run dev
```

<http://localhost:3000> を開く。

### 5. 初回アプリ管理者を作成

詳細は [`supabase/README.md`](supabase/README.md) を参照。要約すると:

1. アプリの `/signup` から **任意の実メールアドレス**（例: `admin@yourorg.com`）+ パスワードでアカウント登録
2. Supabase SQL Editor で次を実行:

```sql
update public.profiles
set role = 'app_admin'
where login_id = 'admin@yourorg.com';
```

> 議長アカウントの `profiles.login_id` には登録時のメールアドレスがそのまま入ります。

3. 以後、アプリ管理者は `/sys/login` から **メールアドレス + パスワード** でログイン。

---

## 使い方

### 学生（参加者）の流れ — パスワードレス

1. 議長から共有された **ルームID** をトップ `/` のフォームに入力 → 「入室画面へ」
2. STEP2: `/r/[id]/enter` で **学籍番号** を入力 → 「入室する」
   - 未登録の場合: エラーが表示され、議長の管理画面にRealtimeで通知される
3. STEP2.5: 「あなたは【田中太郎】さんですか？」の本人確認ダイアログ
   - 「はい、入室する」→ Supabaseのセッションが自動発行される
   - 「いいえ、戻る」→ 学籍番号入力に戻る
4. STEP3（初回のみ）: `/r/[id]/setup-nickname` でニックネームを決定
5. 以降は `/rooms/[id]` のチャットで賛成/反対を選び発言

### 議長になる流れ

1. `/signup` で **メールアドレス + パスワード** で議長アカウントを作成（Confirm email ON の場合は確認メールのリンクをクリック） → `/dashboard` の「新しいルームを作成」にテーマを入力
2. 作成と同時に `/rooms/[id]/manage` へ遷移し、自分が議長になる
3. 「ユーザーを追加（単票入力）」または「ユーザーを追加（CSV一括）」で参加者を登録
   - CSV ヘッダ例: `login_id,name,nickname` (日本語ヘッダ `学籍番号,名前,ニックネーム` も可)
   - **学生用にパスワードは不要**（指定があってもサーバ側でランダムに置き換え、誰にも開示しません）
4. ルームURL（`/r/[id]/enter`）または ルームID を学生に共有
5. 学生が未登録IDで入室を試みた場合、画面右上のベルアイコンに通知バッジ + ポップアップが出る
   - その場で「このIDで登録」ボタンから即時追加可能
6. 必要に応じてテーマ編集・実名表示・強制退出を行う

### アプリ管理者（`/sys`）の流れ

1. `/sys/login` で `app_admin` ロールのメールアドレス + パスワードでログイン
2. `/sys` で全ルーム・全ユーザーを俯瞰、ロール付与（管理者にする / 一般に戻す）が可能
3. 任意のルームの「管理」ボタンからそのルームの管理画面へ入れる

---

## デプロイ（Vercel）

1. このリポジトリを GitHub に push
2. Vercel ダッシュボードで「Import Project」→ リポジトリを選択
3. **Environment Variables** に以下を設定（Production/Preview/Development すべて）
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy ボタン

> Supabase 側で **Authentication → URL Configuration → Site URL** を Vercel の本番 URL に設定しておくと、Cookie ベースの認証が安定します。

---

## ディレクトリ構成

```
app/
  page.tsx                     LP（ルームID入力）
  RoomIdEntryForm.tsx          LP のルームID入力フォーム
  r/[id]/enter/                学生 STEP2 + STEP2.5（入室画面 + 本人確認）
  r/[id]/setup-nickname/       学生 STEP3（初回ニックネーム設定）
  (auth)/login/                議長ログイン
  signup/                      議長セルフサインアップ
  dashboard/                   議長ホーム
  rooms/[id]/                  チャット 3カラム
  rooms/[id]/manage/           議長専用 ルーム管理（NotificationBell 付き）
  sys/login/                   アプリ管理者ログイン
  sys/                         アプリ管理者ダッシュボード
  api/admin/users/import/      Service Role での CSV 一括作成
  api/admin/users/single/      Service Role での単票作成
  api/admin/users/kick/        Service Role での強制退出
  auth/signout/                サインアウト
components/chat/               Barometer / MessageList / MessageInput / ImportantThread
lib/supabase/                  browser / server / admin / middleware の3クライアント
lib/auth.ts                    requireChairOrAppAdmin / requireAppAdmin ヘルパー
lib/createUsers.ts             Service Role による Auth+Profile 作成ロジック
middleware.ts                  認証 + ロールガード（/sys/**, /rooms/[id]/manage, /rooms/[id] 未ログイン時は /r/[id]/enter へ）
supabase/migrations/           DB スキーマと RLS（新規プロジェクト向けに統合済）
  0001_init.sql                テーブル + handle_new_user トリガ + Realtime publication
  0002_rls.sql                 ヘルパー関数 + 全テーブルの RLS ポリシー
```

---

## セキュリティ・設計メモ

### 認証方針

| 区分 | 入力 | 内部表現 (auth.users.email) | profiles.login_id | セッション |
| ---- | ---- | ---------------------------- | ----------------- | ---------- |
| 議長 / アプリ管理者 | 実メール + パスワード | 入力されたメールそのまま | 入力されたメールそのまま | Supabase Auth (cookie) |
| 学生 | 学籍番号のみ（パスワード不要） | `<学籍番号>@debate.local`（擬似・不可視） | 学籍番号 | Supabase Auth (cookie) ＋ 利便性のため `(roomID, 学籍番号)` を localStorage |

- 議長は Supabase の公開 `signUp()` を経由するためメール検証が必要 → 実メール必須（パスワードリセットも標準で動作）
- 学生は **Service Role の `admin.createUser()`** で作成するため `.local` のような非公開 TLD でも作れる（公開 API のメール検証はバイパス）。学生にはこの擬似メールを一切見せない・入力させない
- 学生の `confirmEnter` は `admin.generateLink({type:'magiclink'})` → `auth.verifyOtp()` で本人確認ダイアログの「はい」のあとに自動でセッションを発行（学生は何も操作しない）
- 新規 `auth.users` 行に対しては `handle_new_user()` トリガが `profiles` 行を自動作成（`raw_user_meta_data.{login_id,name,nickname}` を参照、未指定なら email を `login_id` にフォールバック）

### 共通

- パスワードは Supabase Auth が bcrypt で管理
- すべてのテーブルに RLS が有効
  - 議長は `is_chair_of(room_id)` で per-room 管理権限
  - アプリ管理者は `is_app_admin()` で全権限
- 議長による「ユーザー追加・強制退出」は Service Role + サーバ側で `requireChairOrAppAdmin(room_id)` を都度検証してから実行
- Realtime は Postgres の変更通知 (`postgres_changes`) を WebSocket で購読
- レスポンシブ：3カラムは `lg` 以上、それ以下では縦積み

## 既知の制限 / TODO

- ニックネームの重複チェックなし
- 学生のパスワードリセットは概念上不要（学籍番号さえあればいつでも入室可能）
- Storage（画像投稿）には未対応
