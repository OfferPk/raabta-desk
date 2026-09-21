# Raabta Desk — Poora Istemaal Guide (Roman Urdu)

Yeh guide **brief** hai lekin **complete**: download se lekar har feature tak step-by-step.

---

## 1. Yeh software kya hai?

**Raabta Desk** ek simple lead / follow-up desk hai — khas taur pe Pakistan ke SMB teams ke liye jo WhatsApp pe kaam karti hain.

- Leads ek jagah shared rahein (sirf personal phone pe nahi)
- Pipeline (Kanban) pe stage change
- Follow-up overdue list
- Notes
- WhatsApp ek click pe (`wa.me`) — **Meta WhatsApp Business API ki zaroorat nahi**
- **Ads Drop**: Meta Lead Ads ka CSV/Excel upload karke leads andar laao

---

## 2. Kahan se download hoga?

| Cheez | Link |
|--------|------|
| **GitHub repo (source code)** | https://github.com/OfferPk/raabta-desk |
| **Release v0.1.0** | https://github.com/OfferPk/raabta-desk/releases/tag/v0.1.0 |
| **Latest code (main / features)** | repo pe **Code → Download ZIP** ya `git clone` |

**Clone (recommended):**

```bash
git clone https://github.com/OfferPk/raabta-desk.git
cd raabta-desk
```

**ZIP:** GitHub pe green **Code** button → **Download ZIP** → extract → folder kholo.

---

## 3. Pehle kya install hona chahiye?

1. **Node.js 20+** (LTS) — https://nodejs.org  
   Check: `node -v` aur `npm -v`
2. Modern browser (Chrome / Edge / Firefox)
3. (Optional) Git — clone ke liye

Windows / Mac / Linux sab pe same commands kaam karti hain (Terminal / PowerShell / cmd).

---

## 4. Install + Run — step by step

### A) Development mode (rozana use / try-out)

```bash
cd raabta-desk
npm install
npm run seed
npm run dev
```

Browser kholo: **http://localhost:3000**

`seed` demo owner, agent, aur sample leads banata hai. Dobara seed = DB reset (purana demo data wipe).

### B) Production-style local run

```bash
cd raabta-desk
npm install
npm run seed
npm run build
# local HTTP pe cookie ke liye:
# .env.local mein: COOKIE_SECURE=false
npm start
```

Phir: **http://localhost:3000**

### C) Environment (optional)

`.env.example` copy karke `.env.local` banao:

- `DATABASE_PATH` — SQLite file (default `./data/raabta.db`)
- `COOKIE_SECURE=false` — **local HTTP** pe login ke liye zaroori ho sakta hai
- `COOKIE_SECURE=true` — jab real HTTPS pe deploy karo

`data/*.db` aur `.env.local` GitHub pe **commit mat karo** (gitignore mein hain).

---

## 5. Demo login (seed ke baad)

| Role | Email | Password | Kya kar sakta hai |
|------|--------|----------|-------------------|
| **Owner** | `owner@raabta.local` | `owner123` | Sab leads, Team, CSV export, Ads Drop |
| **Agent** | `agent@raabta.local` | `agent123` | Apni / assigned leads, notes, WhatsApp |

Pehli dafa bina seed ke **Register** se naya account banao — **pehla user Owner** ban jata hai. Uske baad public register band.

> Demo passwords sirf local try ke liye hain. Internet pe deploy se pehle strong passwords use karo.

---

## 6. App ka layout (kahan kya hai)

Login ke baad usually yeh sections milte hain:

1. **Dashboard** — counts, overdue, pipeline value (PKR)
2. **Board / Leads (Kanban)** — stages: new → qualified → follow_up → won / lost
3. **Follow-ups** — aaj due + overdue list
4. **Lead detail** — edit, notes, WhatsApp button
5. **Team** (sirf Owner) — agent users banana
6. **Ads Drop / Imports** — Meta CSV/Excel import
7. **Export** (Owner) — leads CSV download

Exact menu names UI version pe thore different ho sakte hain; meaning same hai.

---

## 7. Features — har ek kya karta hai (step-by-step)

### 7.1 Register / Login / Logout

1. `/login` pe email + password
2. Pehla register = **Owner**
3. Logout session khatam karta hai

**Result:** Secure session cookie (httpOnly). Password bcrypt se hash hota hai.

---

### 7.2 Team — Agent banana (Owner)

1. Owner se login
2. **Team** page kholo
3. Name, email, password do → Agent banao  
   (API / UI Owner role dubara create nahi karne deti)

**Result:** Agents shared desk use kar sakte hain; ownership rules apply.

---

### 7.3 Nayi lead banana

1. **New lead** / Add pe click
2. Name + **phone** (Pakistan: `03…` likho to system `92…` bana sakta hai)
3. Optional: email, source, value (PKR), next follow-up, owner
4. Save

**Result:** Lead `new` stage pe board pe dikhegi.

---

### 7.4 Kanban / stages

Stages: `new` | `qualified` | `follow_up` | `won` | `lost`

1. Board kholo
2. Lead card pe stage button dabao (MVP mein drag-drop zaroori nahi)

**Result:** Pipeline clear — kaunsi deal kahan hai.

---

### 7.5 Follow-up queue

1. Follow-ups page / dashboard pe **due today** aur **overdue** dekho
2. Lead kholo → follow-up date set / clear
3. “Done” / “Tomorrow” jaisi actions (agar UI mein hon)

**Result:** WhatsApp wale follow-ups bhoolnay ka chance kam.

---

### 7.6 Notes (activity)

1. Lead detail kholo
2. Note likho → save  
   Notes **append-only** hain (history rehti hai)

**Result:** Team ko pata chalta hai last baat kya hui.

---

### 7.7 WhatsApp button

1. Lead pe phone sahi ho (country code ke sath digits)
2. **WhatsApp** button → browser `https://wa.me/<digits>` kholta hai

**Result:** Turant chat — koi paid WhatsApp API nahi.

---

### 7.8 Dashboard

- Har stage ki count
- Overdue / due today
- Open pipeline value (PKR)

**Result:** Owner ko subah 10-second snapshot.

---

### 7.9 CSV export (Owner)

1. Owner login
2. Export / CSV download
3. Agents ko **403** (allowed nahi)

CSV formula-injection se bachao ke liye cells sanitize hote hain.

---

### 7.10 Ads Drop — Meta leads import (v0.2)

**Kya hai:** Meta Lead Ads / Instant Form se jo CSV ya Excel milta hai, usay Desk mein bulk leads banata hai. **Meta Marketing API / WABA nahi.**

**Steps:**

1. Nav se **Ads Drop** (`/imports`) kholo  
2. CSV ya XLSX upload (size/row limits README mein)  
3. Columns map karo: phone, name, Meta lead id, campaign, …  
   - `first_name` + `last_name` → mil kar **name**  
4. Preview dekho (kitni create / skip / error)  
5. **Commit** — leads `source=meta_ads` (ya `meta_ads`), stage `new`  
6. Optional: follow-up **nudge** (0 / 2 / 4 / 24 hours)  
7. Report dekho / CSV report  
8. Mapping **preset** save karo taake agli dafa map dobara na karna pade  

**Dedupe:** same phone (normalize karke) ya same Meta lead id → duplicate nahi banti.

**Sample file:** repo mein `fixtures/meta-leads-sample.csv` (agar maujood ho).

---

## 8. Rozana workflow (short)

1. Owner / agent login  
2. Dashboard → overdue clear karo  
3. Nayi WhatsApp inquiry → New lead + note  
4. Stage aage badhao  
5. WhatsApp button se follow-up  
6. Haftay mein Meta ads chalain to **Ads Drop** se CSV import  
7. Owner kabhi kabhi CSV export backup

---

## 9. Common masail (troubleshooting)

| Masla | Hal |
|--------|-----|
| `npm install` fail | Node 20+ lagao; purana `node_modules` delete karke dobara install |
| Login cookie kaam nahi (production build + HTTP) | `.env.local` mein `COOKIE_SECURE=false` |
| Port 3000 busy | `npm run dev -- -p 3001` |
| Demo data chahiye reset | `npm run seed` (data wipe) |
| Phone reject / duplicate | Number digits + country code; `03` vs `923` same lead ho sakti hai after normalize |
| Agent CSV export nahi le sakta | Design hai — sirf Owner |
| GitHub pe `.env` / `.db` mat push karo | Already gitignore |

---

## 10. Security / privacy tips

- Demo passwords public deploy pe mat chhoro  
- `data/*.db` backup privately rakho (leads + password hashes)  
- HTTPS pe `COOKIE_SECURE=true`  
- Internet pe open karne se pehle `npm audit` / updates dekho  

---

## 11. Tests (developers)

```bash
npm test      # unit + API checks
npm run build # production build
```

---

## 12. License / madad

- License: **MIT** (repo root `LICENSE`)
- Issues: https://github.com/OfferPk/raabta-desk/issues
- English product notes: `README.md`, `docs/PRODUCT.md`

---

*Factory rule: har naya OfferPk / factory project isi tarah `GUIDE-roman-urdu.md` ke sath ship hoga.*
