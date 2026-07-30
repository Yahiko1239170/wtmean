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

On the final letter screen, click `Done` to generate a share link. The link uses
the URL hash to carry captions, song details, lyrics, and compressed uploaded
images, so the finished page can open on Vercel without a backend. Small uploaded
audio files can also be shared; large audio files are kept local because they
make URLs too large.
