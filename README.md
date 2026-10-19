# 🏏 SATURDAY INDOOR CRICKET MATCH - SAM CRICKET PORTAL

Ek complete aur modern Cricket Match Portal jisme live squad attendance, admin control, cricket loader illusion, aur Netlify hosting support shamil hai.

---

## 🌟 Features (Khasusiyat)

1. **🏏 Cricket Loader & Illusion Screen:**
   - Link kholte hi cricket bat, spinning ball aur LED wickets ka 3D illusion aata hai.
   - Display par **"SATURDAY INDOOR CRICKET MATCH"** likha aata hai.
   - Realistic bat hitting sound effect aur progress bar.

2. **🏆 Trophy, Bat, Ball & Wicket Display:**
   - Reference poster jaisa luxury stadium look aur Championship Golden Trophy display.

3. **📋 Fixed Match Details (Sirf Admin Change Kar Sakta Hai):**
   - 💰 **ENTRY FEE**: Rs. 500 (Default - Admin editable)
   - ⏰ **TIME**: Saturday 09:00 PM - 12:00 AM (Default - Admin editable)
   - 🏦 **SAVING / POOL**: Rs. 2,000 (Default - Admin editable)
   - 📍 **LOCATION**: Google Maps Link jise direct tap karke open kiya ja sakta hai (Admin editable)

4. **⚡ Player Availability (RSVP) Form:**
   - Player apna **NAME** likhega.
   - **ON** (Playing / In 🟢🏏) ya **OFF** (Unavailable / Out 🔴❌) select karega.
   - **SUBMIT BUTTON** dabane par celebratory confetti aur sound effect aayega aur naam list mai jud jayega.

5. **👥 VIEW MORE (Live Squad Roster):**
   - Submit karne ke baad **VIEW MORE** button par click karne se popup modal khulta hai.
   - **ON List**: Jin logo ne ON select kiya unke naam aur total count show hoti hai.
   - **OFF List**: Jin logo ne OFF select kiya unke naam aur total count show hoti hai.
   - Sabhi logo ko live visible hota hai.
   - **WhatsApp Share Button**: 1-click mai pura squad list WhatsApp format mai copy/share karne ki sahulat.

6. **🔐 Admin Control Panel (Phone Friendly):**
   - Header par **Admin Login** button.
   - **Admin Email**: `sameerarif133@gmail.com`
   - **Admin Password**: `Sameer123`
   - Admin apne mobile phone se hi:
     - Entry Fee change kar sakta hai
     - Match Time change kar sakta hai
     - Location aur Google Maps Link change kar sakta hai
     - Saving amount change kar sakta hai
     - Kisi bhi player ko delete ya ON/OFF switch kar sakta hai
     - Naye Saturday match ke liye list reset kar sakta hai.

7. **☁️ Multi-Device Live Cloud Sync:**
   - Ek phone se submit ya change hone par doosre sabhi phones par live data sync ho jata hai.

---

## 🚀 Netlify Par Host Karne Ka Tareeqa (Link: `sam-cricket-potal`)

Aap is website ko 2 minute mai Netlify par free host kar sakte hain:

### Tareeqa (Step-by-Step):

1. **Netlify par jayein:**
   - Browser mai [https://app.netlify.com/drop](https://app.netlify.com/drop) open karein.
   - Apna free Netlify account login / signup karein.

2. **Folder Drag & Drop Karein:**
   - `F:\Compressed\cricket` folder ko mouse se pakad kar Netlify Drop box mai chhor dein (drag and drop karein).
   - Website instant upload aur deploy ho jayegi!

3. **Link Ka Naam Change Karein (`sam-cricket-potal`):**
   - Deploy hone ke baad Netlify par **Site configuration** (ya **Site settings**) mai jayein.
   - **Change site name** par click karein.
   - Box mai likhein: `sam-cricket-potal` (ya `samcricketportal`).
   - **Save** par click karein!

Aapka live link ban jayega:
👉 **`https://sam-cricket-potal.netlify.app`**

---

## 📁 Files Structure

- `index.html` - Main cricket portal page, loader, form, view more modal, admin panel.
- `style.css` - Stadium floodlight theme, cricket bat/ball animations, responsive layout.
- `app.js` - Real-time sync, player submission, admin auth, sound effects, WhatsApp sharing.
- `manifest.json` - Mobile PWA support (Add to Home screen).
- `netlify.toml` - Netlify routing and cache optimizations.
- `assets/` - Cropped poster aur hero trophy banner images.
