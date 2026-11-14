# 🎙️ Microsoft Edge Neural TTS সার্ভিস (Render Deployment Guide)

এই ফোল্ডারটি (`render`) একটি আলাদা নোডজেএস (Node.js) প্রজেক্ট, যা **[Render.com](https://render.com)** ক্লাউডে ফ্রি হোস্ট করার জন্য তৈরি করা হয়েছে। 

### 💡 কেন এটি Render-এ আলাদা হোস্ট করা প্রয়োজন?
- আপনার মূল ৩ডি বইয়ের ওয়েবসাইটটি **InfinityFree**-তে হোস্ট করা (PHP + Static Shared Hosting)।
- InfinityFree ফ্রি সার্ভারে ব্যাকগ্রাউন্ড ডেমোন (Daemon), WebSocket বা Node.js রান করার অনুমতি থাকে না।
- মাইক্রোসফট এজ (Microsoft Edge) টেক্সট-টু-স্পিচ ন্যাচারাল এআই ভয়েস ব্যবহার করার জন্য একটি ব্যাকএন্ড সার্ভিস প্রয়োজন হয়।
- **Render.com** সম্পূর্ণ ফ্রিতে সরাসরি Node.js ওয়েব সার্ভিস হোস্ট করতে দেয় এবং অটোমেটিক HTTPS লিংক প্রদান করে।

---

## 🚀 Render.com-এ ডিপ্লয় করার সহজ ধাপ (Step-by-Step)

### ধাপ ১: GitHub-এ আপলোড করুন
1. আপনার GitHub অ্যাকাউন্টে যান এবং একটি নতুন **New Repository** তৈরি করুন (যেমন: `edge-tts-service`)।
2. এই `render` ফোল্ডারের ফাইলগুলো (যেমন `package.json`, `server.js`, `render.yaml`, `Dockerfile` ইত্যাদি) আপনার GitHub রিপোজিটরিতে পুশ (Push) করুন।

### ধাপ ২: Render.com-এ নতুন Web Service তৈরি করুন
1. **[dashboard.render.com](https://dashboard.render.com)**-এ লগইন করুন (ফ্রি অ্যাকাউন্ট)।
2. **New +** বাটনে ক্লিক করে **Web Service** সিলেক্ট করুন।
3. আপনার গিটহাব রিপোজিটরিটি (`edge-tts-service`) কানেক্ট করুন।
4. সেটিংস ফিল্ডগুলো নিচের মতো পূরণ করুন:
   - **Name:** `edge-tts-service` (বা আপনার পছন্দের নাম)
   - **Region:** যেকোনো নিকটবর্তী রিজিয়ন (যেমন: `Singapore` বা `Oregon`)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. নিচে **Create Web Service** বাটনে ক্লিক করুন। ২ মিনিটের মধ্যে সার্ভিস বিল্ড হয়ে লাইভ হয়ে যাবে!

### ধাপ ৩: Render লিংকটি আপনার ওয়েবসাইটে যুক্ত করুন
1. Render-এর ড্যাশবোর্ড থেকে আপনার তৈরি সার্ভিসের লাইভ URL কপি করুন (যেমন: `https://edge-tts-service-xxxx.onrender.com`)।
2. আপনার বই পড়ার ওয়েবসাইটের (InfinityFree) ওপরে **⚙️ .env সেটিংস** মডালে যান।
3. **EDGE_TTS_URL** ফিল্ডে আপনার এই Render লিংকটি পেস্ট করে সেভ করুন।
4. ব্যাস! এখন থেকে বইয়ের পাতা এবং Gemini AI সামারি—উভয় ক্ষেত্রেই অসাধারণ ন্যাচারাল বাংলা কণ্ঠে (প্রদীপ ও নবনীতা) শুনতে পাবেন!

---

## 📡 API Endpoints

| মেথড | এন্ডপয়েন্ট | কাজ |
|---|---|---|
| `GET` | `/health` | সার্ভিস স্ট্যাটাস ও হেলথ চেক |
| `GET` | `/api/voices` | উপলব্ধ ভয়েসের তালিকা (বাংলা ও ইংরেজি) |
| `GET` | `/api/tts?text=...&voice=...&rate=...` | সরাসরি অডিও স্ট্রিমিং (MP3) |
| `POST` | `/api/tts` | বড় টেক্সট বা সামারির জন্য বডি দিয়ে অডিও জেনারেশন |

### 🇧🇩 উপলব্ধ প্রাকৃতিক বাংলা ভয়েস:
1. `bn-BD-PradeepNeural` — প্রদীপ (বাংলাদেশ, পুরুষ) [ডিফল্ট ও সবচেয়ে স্পষ্ট]
2. `bn-BD-NabanitaNeural` — নবনীতা (বাংলাদেশ, নারী)
3. `bn-IN-BashkarNeural` — ভাস্কর (ভারত, পুরুষ)
4. `bn-IN-TanishaaNeural` — তানিশা (ভারত, নারী)

---

## 💻 লোকাল কম্পিউটারে রান করে টেস্ট করার নিয়ম:
```bash
cd render
npm install
npm start
```
এরপর ব্রাউজারে `http://localhost:3000/health` ওপেন করে দেখতে পারেন।
