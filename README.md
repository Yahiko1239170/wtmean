# Girlfriend's Day Letter

A static, Vercel-ready interactive greeting page inspired by the referenced preview.

## Files

- `index.html` - page markup
- `styles.css` - layout, animations, and responsive design
- `script.js` - story navigation, carousel, song progress, and image editing
- `assets/sticker-sheet.png` - local artwork used by the small image cards
- `vercel.json` - Vercel rewrite config

## Local Preview

Run a simple static server from this folder:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Image Editing

Click any small image card to open it larger. You can replace the image and edit
its caption.

## Song Editing

Use `Edit song` on the player to set a song title, artist, YouTube link, upload
a small audio file, read duration from the file, find synced lyrics from LRCLIB,
or add timestamped lyrics manually.

YouTube links play through a hidden YouTube iframe so the visitor hears the song
without seeing a video. Uploaded audio plays directly in the browser when
available and takes priority over YouTube.

For YouTube links or uploaded audio, set `Start time` and `End time` to choose
the exact segment. The player progress and lyrics use that selected segment
duration.

## Share Link

The original site URL always opens a clean editable template. On the final
letter screen, click `Done` to upload media to Supabase Storage, save the
finished page payload in Supabase, and generate a link like:

```text
https://your-site.vercel.app/?page=PUBLIC_TOKEN&key=VIEW_KEY
```

Opening that link loads the finished page in read-only mode. If someone changes
the `page` token without the matching `key`, the app will not open that saved
page.

## Supabase Storage

For reliable sharing of edited images/audio, create a public Supabase Storage
bucket named `girlfriend-pages`, then paste your Supabase project URL and anon
key into `SUPABASE_URL` and `SUPABASE_ANON_KEY` near the top of `script.js`.

Use storage policies that allow public reads and anon uploads for this bucket:

```sql
create policy "Public read girlfriend pages"
on storage.objects for select
using (bucket_id = 'girlfriend-pages');

create policy "Anon upload girlfriend pages"
on storage.objects for insert
to anon
with check (bucket_id = 'girlfriend-pages');
```

This keeps final links short because the link stores public Supabase URLs instead
of embedding whole files in the URL.

## Supabase Database

Run this once in the Supabase SQL editor:

```sql
create extension if not exists pgcrypto;

create table if not exists public.greeting_pages (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique,
  view_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.greeting_pages enable row level security;

create policy "Anyone can create greeting pages"
on public.greeting_pages
for insert
to anon
with check (
  length(public_token) >= 32
  and length(view_key) >= 32
  and jsonb_typeof(payload) = 'object'
);

create policy "Anyone can read greeting pages by link token"
on public.greeting_pages
for select
to anon
using (true);
```
