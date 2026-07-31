const SHEET_POSITIONS = {
  us: "0% 0%",
  flower: "100% 0%",
  rose: "0% 100%",
  letter: "100% 100%"
};

const DEFAULT_CAPTIONS = {
  us: "every quiet moment with you is my favourite kind.",
  flower: "the day I knew your smile could fix anything.",
  rose: "I would choose this, exactly like this, every time.",
  letter: "a little note for the person I adore."
};

const DEFAULT_PERSON_NAME = "your person";

const DEFAULT_SONG = {
  title: "Our Song",
  artist: "",
  subtitle: "A track that is just us",
  youtube: "",
  audio: "",
  start: 0,
  end: 29,
  duration: 29,
  lyrics:
    "[00:00] You are my favourite line.\n[00:10] Every second feels softer with you.\n[00:20] This little song is ours."
};

const ALBUM_KEYS = ["us", "flower", "rose"];
const PHOTO_KEYS = ["us", "flower", "rose", "letter"];
const STORAGE_PREFIX = "girlfriend-story:";
const SHARE_AUDIO_LIMIT = 650000;
const UPLOAD_AUDIO_LIMIT = 3200000;
const YOUTUBE_FRAME_ID = "youtubePlayerFrame";
const SUPABASE_URL = "https://dalhvmruyivqnhdhtrbl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_m7CSxrXeLoZOKZyxeMV3OQ_49ue442V";
const SUPABASE_BUCKET = "girlfriend-pages";
const SUPABASE_PAGES_TABLE = "greeting_pages";

const intro = document.querySelector("#intro");
const storySections = [...document.querySelectorAll("[data-section]")];
const photoDialog = document.querySelector("#photoDialog");
const songDialog = document.querySelector("#songDialog");
const nameDialog = document.querySelector("#nameDialog");
const shareDialog = document.querySelector("#shareDialog");
const dialogTitle = document.querySelector("#dialogTitle");
const dialogPhoto = document.querySelector("[data-dialog-photo]");
const captionInput = document.querySelector("#captionInput");
const imageInput = document.querySelector("#imageInput");
const albumPhoto = document.querySelector("[data-album-photo]");
const albumCaption = document.querySelector("[data-album-caption]");
const albumCounter = document.querySelector("[data-album-counter]");
const songTitle = document.querySelector("[data-song-title]");
const songSubtitle = document.querySelector("[data-song-subtitle]");
const songCurrent = document.querySelector("[data-song-current]");
const songDuration = document.querySelector("[data-song-duration]");
const songLyric = document.querySelector("[data-song-lyric]");
const songTitleInput = document.querySelector("#songTitleInput");
const artistInput = document.querySelector("#artistInput");
const youtubeInput = document.querySelector("#youtubeInput");
const songStartInput = document.querySelector("#songStartInput");
const songEndInput = document.querySelector("#songEndInput");
const audioInput = document.querySelector("#audioInput");
const songDurationInput = document.querySelector("#songDurationInput");
const durationOutput = document.querySelector("#durationOutput");
const timestampInput = document.querySelector("#timestampInput");
const timestampOutput = document.querySelector("#timestampOutput");
const lyricLineInput = document.querySelector("#lyricLineInput");
const lyricsInput = document.querySelector("#lyricsInput");
const lyricsStatus = document.querySelector("#lyricsStatus");
const personNameInput = document.querySelector("#personNameInput");
const personNameTargets = [...document.querySelectorAll("[data-person-name]")];
const sharedSignature = document.querySelector("[data-shared-signature]");
const shareLink = document.querySelector("#shareLink");
const openShareLink = document.querySelector("#openShareLink");
const shareNote = document.querySelector("[data-share-note]");
const audioPlayer = document.querySelector("[data-audio-player]");
const youtubePlayerHost = document.querySelector("[data-youtube-player]");
const progressBar = document.documentElement;

let currentPhotoKey = "us";
let pendingImage = "";
let pendingAudio = "";
let albumIndex = 0;
let playing = false;
let playTimer = null;
let elapsed = 0;
let sharedView = false;
let activeYoutubeSong = null;
let ytPlayer = null;
let ytPlayerKey = "";
let ytPlayerReady = false;
let pendingYoutubePlay = false;
let ytApiReadyPromise = null;
let supabaseClient = null;
let stateNamespace = `draft:${makeRandomToken(18)}`;

function storageKey(key, field) {
  return `${STORAGE_PREFIX}${stateNamespace}:${key}:${field}`;
}

function songStorageKey(field) {
  return storageKey("song", field);
}

function makeRandomToken(length = 48) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return [...values].map((value) => alphabet[value % alphabet.length]).join("");
}

function clearStateNamespace(namespace = stateNamespace) {
  const prefix = `${STORAGE_PREFIX}${namespace}:`;
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(prefix)) localStorage.removeItem(key);
  });
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function isDataUrl(value) {
  return /^data:[^;]+;base64,/i.test(String(value || ""));
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase?.createClient);
}

function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

function extensionFromMime(mimeType) {
  const clean = String(mimeType || "").split(";")[0].toLowerCase();
  if (clean === "image/jpeg") return "jpg";
  if (clean === "image/png") return "png";
  if (clean === "image/webp") return "webp";
  if (clean === "audio/mpeg") return "mp3";
  if (clean === "audio/mp4") return "m4a";
  if (clean === "audio/wav") return "wav";
  if (clean === "audio/ogg") return "ogg";
  return clean.split("/")[1] || "bin";
}

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const bytes = atob(match[2]);
  const array = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    array[index] = bytes.charCodeAt(index);
  }
  return new Blob([array], { type: match[1] });
}

function randomPath(prefix, mimeType) {
  const random = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}/${random}.${extensionFromMime(mimeType)}`;
}

async function uploadDataUrlToSupabase(dataUrl, prefix) {
  if (!isDataUrl(dataUrl)) return dataUrl;
  const client = getSupabaseClient();
  if (!client) return dataUrl;

  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return dataUrl;

  const path = randomPath(prefix, blob.type);
  const { error } = await client.storage.from(SUPABASE_BUCKET).upload(path, blob, {
    cacheControl: "31536000",
    contentType: blob.type,
    upsert: false
  });

  if (error) throw error;

  const { data } = client.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function getPersonName() {
  return localStorage.getItem(storageKey("person", "name")) || DEFAULT_PERSON_NAME;
}

function savePersonName(value) {
  const name = String(value || "").trim();
  if (name) {
    localStorage.setItem(storageKey("person", "name"), name);
  } else {
    localStorage.removeItem(storageKey("person", "name"));
  }
}

function getCaption(key) {
  return localStorage.getItem(storageKey(key, "caption")) || DEFAULT_CAPTIONS[key] || "";
}

function getImage(key) {
  return localStorage.getItem(storageKey(key, "image")) || "";
}

function getSong() {
  const duration = Number(localStorage.getItem(songStorageKey("duration")));
  return {
    title: localStorage.getItem(songStorageKey("title")) || DEFAULT_SONG.title,
    artist: localStorage.getItem(songStorageKey("artist")) || DEFAULT_SONG.artist,
    subtitle: localStorage.getItem(songStorageKey("subtitle")) || DEFAULT_SONG.subtitle,
    youtube: localStorage.getItem(songStorageKey("youtube")) || DEFAULT_SONG.youtube,
    audio: localStorage.getItem(songStorageKey("audio")) || DEFAULT_SONG.audio,
    start: Number(localStorage.getItem(songStorageKey("start"))) || DEFAULT_SONG.start,
    end: Number(localStorage.getItem(songStorageKey("end"))) || duration || DEFAULT_SONG.end,
    duration: Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_SONG.duration,
    lyrics: localStorage.getItem(songStorageKey("lyrics")) || DEFAULT_SONG.lyrics
  };
}

function saveSongData(song) {
  localStorage.setItem(songStorageKey("title"), song.title || DEFAULT_SONG.title);
  localStorage.setItem(songStorageKey("artist"), song.artist || "");
  localStorage.setItem(songStorageKey("subtitle"), song.subtitle || DEFAULT_SONG.subtitle);
  localStorage.setItem(songStorageKey("youtube"), song.youtube || "");
  localStorage.setItem(songStorageKey("start"), String(song.start || 0));
  localStorage.setItem(songStorageKey("end"), String(song.end || song.duration || DEFAULT_SONG.duration));
  localStorage.setItem(songStorageKey("duration"), String(song.duration || DEFAULT_SONG.duration));
  localStorage.setItem(songStorageKey("lyrics"), song.lyrics || DEFAULT_SONG.lyrics);

  if (song.audio) {
    localStorage.setItem(songStorageKey("audio"), song.audio);
  } else {
    localStorage.removeItem(songStorageKey("audio"));
  }
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${mins}:${String(rem).padStart(2, "0")}`;
}

function formatLrcTime(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const mins = Math.floor(seconds / 60);
  const rem = seconds - mins * 60;
  return `[${String(mins).padStart(2, "0")}:${rem.toFixed(2).padStart(5, "0")}]`;
}

function parseTimeStamp(value) {
  const text = String(value).trim();
  const lrcMatch = text.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/);
  const plainMatch = text.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?/);
  const match = lrcMatch || plainMatch;
  if (!match) return null;
  const mins = Number(match[1]);
  const seconds = Number(match[2]);
  const decimal = match[3] ? Number(`0.${match[3]}`) : 0;
  return mins * 60 + seconds + decimal;
}

function parseLooseTime(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.max(0, Number(text));
  const parts = text.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
  if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return 0;
}

function parseYouTubeId(url) {
  const text = String(url || "").trim();
  if (!text) return "";

  const match = text.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/
  );
  if (match) return match[1];

  try {
    const parsed = new URL(text);
    return parsed.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

function youtubeSongKey(song) {
  return [parseYouTubeId(song.youtube), song.start, song.end].join(":");
}

function ensureYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiReadyPromise) return ytApiReadyPromise;

  ytApiReadyPromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === "function") previousReady();
      resolve();
    };

    if (!document.querySelector("script[src='https://www.youtube.com/iframe_api']")) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });

  return ytApiReadyPromise;
}

async function prepareHiddenYouTube(song, options = {}) {
  const id = parseYouTubeId(song.youtube);
  if (!id) return false;
  const key = youtubeSongKey(song);

  if (ytPlayer && ytPlayerKey === key) {
    activeYoutubeSong = song;
    if (options.play && ytPlayerReady && ytPlayer.playVideo) {
      ytPlayer.seekTo(Math.min(song.start + elapsed, song.end - 0.1), true);
      ytPlayer.playVideo();
    } else if (options.play) {
      pendingYoutubePlay = true;
    }
    return true;
  }

  await ensureYouTubeApi();
  if (ytPlayer?.destroy) {
    try {
      ytPlayer.destroy();
    } catch {
      // The iframe can already be gone after a fast replay.
    }
  }
  youtubePlayerHost.innerHTML = "";
  const playerTarget = document.createElement("div");
  playerTarget.id = YOUTUBE_FRAME_ID;
  youtubePlayerHost.appendChild(playerTarget);
  activeYoutubeSong = song;
  ytPlayerKey = key;
  ytPlayerReady = false;
  pendingYoutubePlay = Boolean(options.play);

  ytPlayer = new window.YT.Player(YOUTUBE_FRAME_ID, {
    videoId: id,
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      end: song.end,
      fs: 0,
      modestbranding: 1,
      origin: window.location.origin,
      playsinline: 1,
      rel: 0,
      start: song.start
    },
    events: {
      onReady: (event) => {
        ytPlayerReady = true;
        event.target.seekTo(song.start, true);
        if (pendingYoutubePlay) {
          event.target.playVideo();
          pendingYoutubePlay = false;
        }
      },
      onStateChange: (event) => {
        if (event.data === window.YT.PlayerState.ENDED) {
          elapsed = song.duration;
          renderSong();
          stopSong();
        }
      }
    }
  });
  return true;
}

function startHiddenYouTube(song) {
  return prepareHiddenYouTube(song, { play: true });
}

function getYouTubeElapsed(song) {
  if (!activeYoutubeSong || activeYoutubeSong.youtube !== song.youtube) return null;
  if (!ytPlayer?.getCurrentTime || typeof ytPlayer.getCurrentTime !== "function") return null;

  const currentTime = Number(ytPlayer.getCurrentTime());
  if (!Number.isFinite(currentTime)) return null;

  const clampedTime = Math.min(song.end, Math.max(song.start, currentTime));
  return clampedTime - song.start;
}

function primeYouTubePlayer(song = getSong()) {
  if (!song.youtube || song.audio) return;
  prepareHiddenYouTube(song).catch(() => {
    stopHiddenYouTube();
  });
}

function stopHiddenYouTube() {
  activeYoutubeSong = null;
  pendingYoutubePlay = false;
  ytPlayerReady = false;
  ytPlayerKey = "";
  if (ytPlayer?.destroy) {
    try {
      ytPlayer.destroy();
    } catch {
      // Ignore a player that YouTube already removed.
    }
  }
  ytPlayer = null;
  youtubePlayerHost.innerHTML = "";
}

function normalizeSongTimes(startValue, endValue, fallbackDuration = DEFAULT_SONG.duration) {
  const start = Math.max(0, Math.round(parseLooseTime(startValue)));
  const parsedEnd = Math.round(parseLooseTime(endValue));
  const end = parsedEnd > start ? parsedEnd : start + Math.max(1, Math.round(fallbackDuration));
  return {
    start,
    end,
    duration: Math.max(1, end - start)
  };
}

function parseTimedLyrics(text) {
  return String(text)
    .split(/\n+/)
    .map((line) => {
      const time = parseTimeStamp(line);
      const lyric = line
        .replace(/^\[\d{1,2}:\d{2}(?:\.\d{1,2})?\]\s*/, "")
        .replace(/^\d{1,2}:\d{2}(?:\.\d{1,2})?\s*/, "")
        .trim();
      return time === null || !lyric ? null : { time, lyric };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
}

function plainLyricLines(song = getSong()) {
  return song.lyrics
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^\[\d{1,2}:\d{2}(?:\.\d{1,2})?\]\s*/, "")
        .replace(/^\d{1,2}:\d{2}(?:\.\d{1,2})?\s*/, "")
        .trim()
    )
    .filter(Boolean);
}

function activeLyric(song = getSong()) {
  const timed = parseTimedLyrics(song.lyrics);
  if (timed.length) {
    const current = timed.filter((line) => line.time <= elapsed).pop();
    return current?.lyric || timed[0].lyric || "";
  }

  const lines = plainLyricLines(song);
  if (!lines.length) return "";
  const ratio = Math.min(0.999, elapsed / song.duration);
  return lines[Math.floor(ratio * lines.length)] || lines[0];
}

function renderSong() {
  const song = getSong();
  const boundedElapsed = Math.min(song.duration, Math.max(0, elapsed));
  const percent = song.duration ? (boundedElapsed / song.duration) * 100 : 0;
  const showAbsoluteTime = song.start > 0 || song.end !== song.duration;
  songTitle.textContent = song.title;
  songSubtitle.textContent = song.artist || (song.youtube ? "YouTube link saved" : song.subtitle);
  songCurrent.textContent = formatTime(showAbsoluteTime ? song.start + boundedElapsed : boundedElapsed);
  songDuration.textContent = formatTime(showAbsoluteTime ? song.end : song.duration);
  songLyric.textContent = activeLyric(song);
  progressBar.style.setProperty("--song-progress", `${Math.min(100, percent)}%`);
}

function syncSongEditorLimits(duration) {
  const max = Math.max(1, Math.round(duration || DEFAULT_SONG.duration));
  songDurationInput.max = String(Math.max(900, max));
  songDurationInput.value = String(max);
  timestampInput.max = String(max);
  timestampInput.value = String(Math.min(Number(timestampInput.value) || 0, max));
  durationOutput.textContent = formatTime(max);
  timestampOutput.textContent = formatTime(Number(timestampInput.value));
}

function applyPhoto(el, key) {
  if (!el || !key) return;
  const saved = getImage(key);
  el.dataset.photoKey = key;

  if (saved) {
    el.style.backgroundImage = `url("${saved}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  } else {
    el.style.backgroundImage = "var(--sticker-sheet)";
    el.style.backgroundSize = "200% 200%";
    el.style.backgroundPosition = SHEET_POSITIONS[key] || "0% 0%";
  }
}

function renderPhotos() {
  document.querySelectorAll("[data-photo-key]").forEach((el) => {
    applyPhoto(el, el.dataset.photoKey);
  });

  document.querySelectorAll("[data-caption-for]").forEach((el) => {
    el.textContent = getCaption(el.dataset.captionFor);
  });

  renderAlbum();
}

function renderPersonName() {
  const name = getPersonName();
  personNameTargets.forEach((target) => {
    target.textContent = name;
  });
}

function renderAlbum() {
  const key = ALBUM_KEYS[albumIndex];
  applyPhoto(albumPhoto, key);
  albumCaption.textContent = getCaption(key);
  albumCounter.textContent = `${String(albumIndex + 1).padStart(2, "0")} / 03`;

  document.querySelectorAll("[data-thumb]").forEach((thumb) => {
    thumb.classList.toggle("is-active", Number(thumb.dataset.thumb) === albumIndex);
  });
}

function showSection(name) {
  storySections.forEach((section) => {
    section.hidden = section.dataset.section !== name;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function beginStory() {
  intro.classList.remove("is-active");
  setTimeout(() => {
    intro.hidden = true;
  }, 480);
  showSection("home");
}

function restartStory() {
  stopSong();
  intro.hidden = false;
  requestAnimationFrame(() => intro.classList.add("is-active"));
  showSection("home");
}

function openPhotoEditor(key) {
  if (sharedView) return;
  currentPhotoKey = key;
  pendingImage = "";
  imageInput.value = "";
  dialogTitle.textContent = key === "us" ? "Our Memory" : "Memory";
  captionInput.value = getCaption(key);
  applyPhoto(dialogPhoto, key);
  photoDialog.showModal();
}

async function savePhoto() {
  const caption = captionInput.value.trim();
  if (caption) {
    localStorage.setItem(storageKey(currentPhotoKey, "caption"), caption);
  } else {
    localStorage.removeItem(storageKey(currentPhotoKey, "caption"));
  }

  if (pendingImage) {
    try {
      localStorage.setItem(
        storageKey(currentPhotoKey, "image"),
        await uploadDataUrlToSupabase(pendingImage, "images")
      );
    } catch {
      localStorage.setItem(storageKey(currentPhotoKey, "image"), pendingImage);
    }
  }

  renderPhotos();
  photoDialog.close();
}

function resetPhoto() {
  localStorage.removeItem(storageKey(currentPhotoKey, "caption"));
  localStorage.removeItem(storageKey(currentPhotoKey, "image"));
  pendingImage = "";
  imageInput.value = "";
  captionInput.value = DEFAULT_CAPTIONS[currentPhotoKey] || "";
  renderPhotos();
  applyPhoto(dialogPhoto, currentPhotoKey);
}

function openNameEditor() {
  if (sharedView) return;
  personNameInput.value = getPersonName();
  nameDialog.showModal();
}

function saveName() {
  savePersonName(personNameInput.value);
  renderPersonName();
  nameDialog.close();
}

function resetName() {
  localStorage.removeItem(storageKey("person", "name"));
  personNameInput.value = DEFAULT_PERSON_NAME;
  renderPersonName();
}

function openSongEditor() {
  if (sharedView) return;
  const song = getSong();
  pendingAudio = song.audio || "";
  songTitleInput.value = song.title;
  artistInput.value = song.artist;
  youtubeInput.value = song.youtube;
  songStartInput.value = formatTime(song.start || 0);
  songEndInput.value = formatTime(song.end || song.duration);
  lyricsInput.value = song.lyrics;
  lyricLineInput.value = "";
  audioInput.value = "";
  syncSongEditorLimits(song.duration);
  lyricsStatus.textContent = "";
  songDialog.showModal();
}

function saveSong() {
  const times = normalizeSongTimes(
    songStartInput.value,
    songEndInput.value,
    Number(songDurationInput.value) || DEFAULT_SONG.duration
  );
  saveSongData({
    title: songTitleInput.value.trim() || DEFAULT_SONG.title,
    artist: artistInput.value.trim(),
    subtitle: DEFAULT_SONG.subtitle,
    youtube: youtubeInput.value.trim(),
    audio: pendingAudio,
    start: times.start,
    end: times.end,
    duration: times.duration,
    lyrics: lyricsInput.value.trim() || DEFAULT_SONG.lyrics
  });
  elapsed = 0;
  stopSong();
  renderSong();
  songDialog.close();
}

function resetSong() {
  Object.keys(DEFAULT_SONG).forEach((field) => {
    localStorage.removeItem(songStorageKey(field));
  });
  pendingAudio = "";
  audioInput.value = "";
  const song = getSong();
  songTitleInput.value = song.title;
  artistInput.value = song.artist;
  youtubeInput.value = song.youtube;
  songStartInput.value = formatTime(song.start || 0);
  songEndInput.value = formatTime(song.end || song.duration);
  lyricsInput.value = song.lyrics;
  syncSongEditorLimits(song.duration);
  elapsed = 0;
  stopSong();
  renderSong();
  lyricsStatus.textContent = "Song reset.";
}

function addLyricLine() {
  const text = lyricLineInput.value.trim();
  if (!text) {
    lyricsStatus.textContent = "Write a lyric line first.";
    return;
  }

  const time = Number(timestampInput.value) || 0;
  const lines = parseTimedLyrics(lyricsInput.value);
  lines.push({ time, lyric: text });
  lines.sort((a, b) => a.time - b.time);
  lyricsInput.value = lines.map((line) => `${formatLrcTime(line.time)} ${line.lyric}`).join("\n");
  lyricLineInput.value = "";
  lyricsStatus.textContent = `Added at ${formatTime(time)}.`;
}

function syncTimestampToPlayback() {
  const song = getSong();
  let currentElapsed = elapsed;

  if (song.audio && !audioPlayer.paused) {
    currentElapsed = Math.max(0, Math.min(song.duration, audioPlayer.currentTime - song.start));
    elapsed = currentElapsed;
  } else if (song.youtube && !song.audio) {
    const youtubeElapsed = getYouTubeElapsed(song);
    if (youtubeElapsed !== null) {
      currentElapsed = youtubeElapsed;
      elapsed = youtubeElapsed;
    }
  }

  timestampInput.value = String(Math.round(currentElapsed));
  timestampOutput.textContent = formatTime(currentElapsed);
}

async function findSyncedLyrics() {
  const title = songTitleInput.value.trim();
  const artist = artistInput.value.trim();
  const duration = Math.round(Number(songDurationInput.value) || 0);

  if (!title) {
    lyricsStatus.textContent = "Add a song title first.";
    return;
  }

  lyricsStatus.textContent = "Searching LRCLIB...";

  try {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
      duration: String(duration)
    });
    const exact = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: { Accept: "application/json" }
    });

    let records = [];
    if (exact.ok) {
      records = [await exact.json()];
    }

    if (!records.length) {
      const q = encodeURIComponent(`${title} ${artist}`.trim());
      const search = await fetch(`https://lrclib.net/api/search?q=${q}`, {
        headers: { Accept: "application/json" }
      });
      if (search.ok) records = await search.json();
    }

    const synced = records
      .filter((record) => record?.syncedLyrics)
      .sort((a, b) => {
        const diffA = Math.abs(Number(a.duration || 0) - duration);
        const diffB = Math.abs(Number(b.duration || 0) - duration);
        return diffA - diffB;
      })[0];

    if (!synced) {
      lyricsStatus.textContent = "No synced lyrics found. Add timestamp lines manually.";
      return;
    }

    lyricsInput.value = synced.syncedLyrics;
    songTitleInput.value = synced.trackName || title;
    artistInput.value = synced.artistName || artist;
    if (synced.duration) syncSongEditorLimits(Math.round(synced.duration));
    lyricsStatus.textContent = "Synced lyrics added.";
  } catch {
    lyricsStatus.textContent = "Could not reach LRCLIB. You can still add timestamps manually.";
  }
}

function toggleSong() {
  const song = getSong();
  if (playing) {
    stopSong();
    return;
  }

  playing = true;
  document.querySelector("[data-action='play']").innerHTML =
    '<span aria-hidden="true">&#10074;&#10074;</span>';

  if (song.audio) {
    audioPlayer.src = song.audio;
    audioPlayer.currentTime = Math.min(song.start + elapsed, Math.max(song.start, song.end - 0.1));
    audioPlayer.play().catch(() => {
      stopSong();
    });
  } else if (song.youtube) {
    startHiddenYouTube(song).then((started) => {
      if (!started) stopSong();
    });
  }

  playTimer = window.setInterval(() => {
    if (song.audio && !audioPlayer.paused) {
      elapsed = Math.max(0, Math.min(song.duration, audioPlayer.currentTime - song.start));
    } else if (song.youtube && !song.audio) {
      const youtubeElapsed = getYouTubeElapsed(song);
      if (youtubeElapsed !== null) {
        elapsed = youtubeElapsed;
      }
    } else {
      elapsed += 0.5;
    }

    if (elapsed >= song.duration) {
      if (song.audio) audioPlayer.currentTime = song.start;
      renderSong();
      stopSong();
      elapsed = 0;
      return;
    }
    renderSong();
  }, 500);
}

function stopSong() {
  const song = getSong();
  playing = false;
  window.clearInterval(playTimer);
  audioPlayer.pause();
  stopHiddenYouTube();
  const playButton = document.querySelector("[data-action='play']");
  if (playButton) {
    playButton.innerHTML = '<span aria-hidden="true">&#9654;</span>';
  }
  primeYouTubePlayer(song);
}

function resizeImageFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const image = new Image();
      image.addEventListener("load", () => {
        const maxSize = 520;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = "#fffafd";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.74));
      });
      image.addEventListener("error", () => resolve(String(reader.result || "")));
      image.src = String(reader.result || "");
    });
    reader.addEventListener("error", () => resolve(""));
    reader.readAsDataURL(file);
  });
}

function readAudioFile(file) {
  return new Promise((resolve) => {
    if (file.size > UPLOAD_AUDIO_LIMIT) {
      lyricsStatus.textContent = "Audio is too large for this static version. Use a smaller file or YouTube link.";
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const audioData = String(reader.result || "");
      const probe = new Audio();
      probe.preload = "metadata";
      probe.addEventListener("loadedmetadata", () => {
        const duration = Math.max(1, Math.round(probe.duration || DEFAULT_SONG.duration));
        syncSongEditorLimits(duration);
        songStartInput.value = "0:00";
        songEndInput.value = formatTime(duration);
        youtubeInput.value = "";
        if (!songTitleInput.value.trim() || songTitleInput.value === DEFAULT_SONG.title) {
          songTitleInput.value = file.name.replace(/\.[^.]+$/, "").slice(0, 42);
        }
        lyricsStatus.textContent = `Audio uploaded. Duration set to ${formatTime(duration)}. Add or paste lyrics, then save.`;
        resolve(audioData);
      });
      probe.addEventListener("error", () => {
        youtubeInput.value = "";
        lyricsStatus.textContent = "Audio uploaded, but duration could not be read. Add lyrics, then save.";
        resolve(audioData);
      });
      probe.src = audioData;
    });
    reader.addEventListener("error", () => resolve(""));
    reader.readAsDataURL(file);
  });
}

function collectSharePayload() {
  const captions = {};
  const images = {};
  const song = getSong();

  PHOTO_KEYS.forEach((key) => {
    const caption = localStorage.getItem(storageKey(key, "caption"));
    const image = localStorage.getItem(storageKey(key, "image"));
    if (caption) captions[key] = caption;
    if (image) images[key] = image;
  });

  if (song.audio && song.audio.length > SHARE_AUDIO_LIMIT) {
    song.audio = "";
  }

  return {
    v: 1,
    captions,
    images,
    personName: getPersonName(),
    song
  };
}

async function uploadStoredMediaForSharing() {
  if (!isSupabaseConfigured()) return false;

  for (const key of PHOTO_KEYS) {
    const imageKey = storageKey(key, "image");
    const image = localStorage.getItem(imageKey);
    if (isDataUrl(image)) {
      localStorage.setItem(imageKey, await uploadDataUrlToSupabase(image, "images"));
    }
  }

  const song = getSong();
  if (isDataUrl(song.audio)) {
    saveSongData({
      ...song,
      audio: await uploadDataUrlToSupabase(song.audio, "audio")
    });
  }

  return true;
}

function toBase64Url(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function applySharePayload(payload) {
  if (!payload || payload.v !== 1) return false;

  Object.entries(payload.captions || {}).forEach(([key, value]) => {
    if (PHOTO_KEYS.includes(key) && value) {
      localStorage.setItem(storageKey(key, "caption"), String(value));
    }
  });

  Object.entries(payload.images || {}).forEach(([key, value]) => {
    if (PHOTO_KEYS.includes(key) && (String(value).startsWith("data:image/") || isRemoteUrl(value))) {
      localStorage.setItem(storageKey(key, "image"), String(value));
    }
  });

  if (payload.song) {
    saveSongData({
      title: String(payload.song.title || DEFAULT_SONG.title),
      artist: String(payload.song.artist || ""),
      subtitle: String(payload.song.subtitle || DEFAULT_SONG.subtitle),
      youtube: String(payload.song.youtube || ""),
      audio: String(payload.song.audio || ""),
      duration: Number(payload.song.duration) || DEFAULT_SONG.duration,
      start: Number(payload.song.start) || 0,
      end: Number(payload.song.end) || Number(payload.song.duration) || DEFAULT_SONG.duration,
      lyrics: String(payload.song.lyrics || DEFAULT_SONG.lyrics)
    });
  }

  savePersonName(payload.personName || DEFAULT_PERSON_NAME);

  return true;
}

function enterSharedMode() {
  sharedView = true;
  document.body.classList.add("shared-view");
  sharedSignature.hidden = false;
  [photoDialog, songDialog, nameDialog, shareDialog].forEach((dialog) => {
    if (dialog.open) dialog.close();
  });
  stopSong();
  intro.hidden = false;
  intro.classList.add("is-active");
  showSection("home");
}

async function saveFinishedPage(payload) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");

  const publicToken = makeRandomToken(40);
  const viewKey = makeRandomToken(56);
  const { error } = await client.from(SUPABASE_PAGES_TABLE).insert({
    public_token: publicToken,
    view_key: viewKey,
    payload
  });

  if (error) throw error;

  return { publicToken, viewKey };
}

async function loadSupabasePage(publicToken, viewKey) {
  const client = getSupabaseClient();
  if (!client || !publicToken || !viewKey) return false;

  const { data, error } = await client
    .from(SUPABASE_PAGES_TABLE)
    .select("payload")
    .eq("public_token", publicToken)
    .eq("view_key", viewKey)
    .single();

  if (error || !data?.payload) return false;

  stateNamespace = `page:${publicToken}`;
  clearStateNamespace();
  if (!applySharePayload(data.payload)) return false;

  enterSharedMode();
  renderPhotos();
  renderPersonName();
  renderSong();
  return true;
}

function loadLegacyHashPage() {
  const hash = window.location.hash || "";
  const match = hash.match(/#done=([^&]+)/);
  if (!match) return false;

  try {
    const payload = fromBase64Url(match[1]);
    stateNamespace = `legacy:${makeRandomToken(18)}`;
    clearStateNamespace();
    if (applySharePayload(payload)) {
      enterSharedMode();
      renderPhotos();
      renderPersonName();
      renderSong();
      return true;
    }
  } catch {
    window.location.hash = "";
  }

  return false;
}

async function loadSharedPage() {
  const params = new URLSearchParams(window.location.search);
  const publicToken = params.get("page");
  const viewKey = params.get("key");

  if (publicToken || viewKey) {
    const loaded = await loadSupabasePage(publicToken, viewKey);
    if (!loaded) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    return loaded;
  }

  return loadLegacyHashPage();
}

async function finishAndShare() {
  shareNote.textContent = "Preparing share link...";

  try {
    await uploadStoredMediaForSharing();
  } catch {
    shareNote.textContent = "Could not upload media to Supabase. The link will use local data where possible.";
  }

  const song = getSong();
  const payload = collectSharePayload();
  const isLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  let url = "";
  try {
    const { publicToken, viewKey } = await saveFinishedPage(payload);
    const params = new URLSearchParams({ page: publicToken, key: viewKey });
    url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  } catch {
    const encoded = toBase64Url(payload);
    url = `${window.location.origin}${window.location.pathname}#done=${encoded}`;
  }

  shareLink.value = url;
  openShareLink.href = url;

  if (isLocalPreview) {
    shareNote.textContent =
      "This is a localhost preview link. Deploy to Vercel and click Done on the Vercel URL before sharing.";
  } else if (url.includes("#done=")) {
    shareNote.textContent = "Could not save to Supabase, so this fallback link may be long.";
  } else if (!isSupabaseConfigured() && Object.keys(payload.images).some((key) => isDataUrl(payload.images[key]))) {
    shareNote.textContent =
      "Supabase is not configured yet, so image data is inside this long link.";
  } else if (song.audio && !payload.song.audio) {
    shareNote.textContent =
      "Uploaded audio is too large for a share link. The page will share lyrics and visuals; use YouTube for public audio.";
  } else if (url.length > 1800) {
    shareNote.textContent = "This link is large because it includes uploaded media.";
  } else {
    shareNote.textContent = "Ready to share.";
  }

  shareDialog.showModal();
}

async function copyShareLink() {
  shareLink.select();
  try {
    await navigator.clipboard.writeText(shareLink.value);
    shareNote.textContent = "Copied.";
  } catch {
    document.execCommand("copy");
    shareNote.textContent = "Copied.";
  }
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  const next = event.target.closest("[data-next]")?.dataset.next;
  const editable = event.target.closest(".editable-photo");

  if (next) {
    showSection(next);
    return;
  }

  if (action === "begin") beginStory();
  if (action === "restart") restartStory();
  if (action === "open-first-photo") openPhotoEditor("us");
  if (action === "open-song-editor") openSongEditor();
  if (action === "open-name-editor") openNameEditor();
  if (action === "previous") {
    albumIndex = (albumIndex + ALBUM_KEYS.length - 1) % ALBUM_KEYS.length;
    renderAlbum();
  }
  if (action === "next") {
    albumIndex = (albumIndex + 1) % ALBUM_KEYS.length;
    renderAlbum();
  }
  if (action === "play") toggleSong();
  if (action === "save-photo") savePhoto();
  if (action === "reset-photo") resetPhoto();
  if (action === "save-song") saveSong();
  if (action === "reset-song") resetSong();
  if (action === "save-name") saveName();
  if (action === "reset-name") resetName();
  if (action === "find-lyrics") findSyncedLyrics();
  if (action === "add-lyric-line") addLyricLine();
  if (action === "use-current-time") {
    syncTimestampToPlayback();
  }
  if (action === "finish") finishAndShare();
  if (action === "copy-link") copyShareLink();

  if (!action && editable && editable.dataset.photoKey && !editable.dataset.thumb) {
    openPhotoEditor(editable.dataset.photoKey);
  }
});

document.querySelectorAll("[data-thumb]").forEach((thumb) => {
  thumb.addEventListener("click", (event) => {
    albumIndex = Number(event.currentTarget.dataset.thumb);
    renderAlbum();
  });
});

songDurationInput.addEventListener("input", () => {
  const duration = Number(songDurationInput.value);
  durationOutput.textContent = formatTime(duration);
  timestampInput.max = String(duration);
  songEndInput.value = formatTime(parseLooseTime(songStartInput.value) + duration);
});

songStartInput.addEventListener("change", () => {
  const duration = Number(songDurationInput.value) || DEFAULT_SONG.duration;
  const times = normalizeSongTimes(songStartInput.value, songEndInput.value, duration);
  songStartInput.value = formatTime(times.start);
  songEndInput.value = formatTime(times.end);
  syncSongEditorLimits(times.duration);
});

songEndInput.addEventListener("change", () => {
  const duration = Number(songDurationInput.value) || DEFAULT_SONG.duration;
  const times = normalizeSongTimes(songStartInput.value, songEndInput.value, duration);
  songStartInput.value = formatTime(times.start);
  songEndInput.value = formatTime(times.end);
  syncSongEditorLimits(times.duration);
});

timestampInput.addEventListener("input", () => {
  timestampOutput.textContent = formatTime(Number(timestampInput.value));
});

audioInput.addEventListener("change", async () => {
  const file = audioInput.files?.[0];
  if (!file) return;
  pendingAudio = await readAudioFile(file);
});

imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];
  if (!file) return;

  pendingImage = await resizeImageFile(file);
  if (!pendingImage) return;
  dialogPhoto.style.backgroundImage = `url("${pendingImage}")`;
  dialogPhoto.style.backgroundSize = "cover";
  dialogPhoto.style.backgroundPosition = "center";
});

intro.addEventListener("click", beginStory);
window.addEventListener("hashchange", loadSharedPage);

async function initializePage() {
  const loadedSharedPage = await loadSharedPage();

  if (!loadedSharedPage) {
    renderPhotos();
    renderPersonName();
    renderSong();
  }

  primeYouTubePlayer();
}

initializePage();
