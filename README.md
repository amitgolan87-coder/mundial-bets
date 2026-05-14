# ⚽ מונדיאל בטס

אתר הימורים חברתי למונדיאל - בנוי על React + Firebase + Netlify

## ✨ מה יש במערכת

### 4 טבלאות אלופים
- 👑 **מלך המונדיאל** - סה"כ נקודות (משחקים + לייב + דו-קרב)
- ⚽ **מלך המשחקים** - רק נקודות מניחושי משחקים
- 🔥 **מלך הימורי לייב** - רק נקודות מהימורי לייב
- ⚔️ **מלך הדו-קרב** - רק נקודות מדו-קרבים

### מנגנוני הימור

**1. ניחושי משחקים** - 15 נקודות מתחלקות בין ניצחון-תיקו-ניצחון לפי סיכויים. אדמין מגדיר את היחס. כיוון נכון = נקודות הכיוון. תוצאה מדויקת = הכפלה.

**2. הימורי לייב** - האדמין יוצר אתגרים ("יבקיעו 4 שערים ב-3 משחקים") עם יחס. שחקנים מסכנים נקודות מהמאזן. פגעת = stake × יחס.

**3. דו-קרבים** - שחקן זורק אתגר, אחר מקבל. נקודות מול נקודות, המנצח לוקח הכל.

### תכונות אבטחה
- 🔒 לא רואים ניחושים של אחרים עד שהמשחק נסגר (24 שעות לפני בעיטה ראשונה)
- 🔒 לא ניתן ליצור מאזן שלילי
- 🔒 חוקי Firestore אוכפים את כל המגבלות בצד השרת
- 🤖 הימור אוטומטי רנדומלי (תוצאות הגיוניות כדורגלית) למי ששכח

---

## 🚀 הקמה מלאה - שלב אחר שלב

### שלב 1: יצירת פרויקט Firebase

1. היכנס ל-[Firebase Console](https://console.firebase.google.com)
2. **Add project** → תן שם (למשל `mundial-bets`)
3. אחרי שהפרויקט נוצר:
   - **Authentication** → Get Started → הפעל את **Email/Password**
   - **Firestore Database** → Create database → Production mode → בחר אזור (`europe-west1` עובד טוב לישראל)
4. **Project Settings** (גלגל שיניים למעלה) → גלול ל-Your apps → לחץ על אייקון Web `</>`
5. רשום את האפליקציה (אין צורך ב-hosting כרגע) - העתק את ה-`firebaseConfig` שמופיע

### שלב 2: הקמת חוקי האבטחה

ב-Firestore Console → Rules → העתק את התוכן של `firestore.rules` והדבק שם → Publish.

(לחלופין, אם יש לך Firebase CLI: `firebase deploy --only firestore:rules`)

### שלב 3: העלאת הקוד ל-GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create mundial-bets --public --source=. --push
```

(או דרך הממשק של GitHub)

### שלב 4: דפלוי לנטליפיי

1. היכנס ל-[Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. בחר את הריפו מ-GitHub
3. הגדרות בנייה - יהיו אוטומטיות מ-`netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. **לפני** שתלחץ Deploy - היכנס ל-**Site settings → Environment variables** והוסף את כל המשתנים:

```
VITE_FIREBASE_API_KEY        = AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN    = your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID     = your-project-id
VITE_FIREBASE_STORAGE_BUCKET = your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID = 123456789
VITE_FIREBASE_APP_ID         = 1:123:web:abc
```

(הערכים האלו מ-`firebaseConfig` שהעתקת בשלב 1)

5. עכשיו לחץ **Deploy site**!

### שלב 5: הוספת הדומיין של Netlify לאישור Firebase

1. אחרי שהאתר עלה, העתק את הכתובת (למשל `https://gentle-marzipan.netlify.app`)
2. Firebase Console → **Authentication → Settings → Authorized domains** → Add domain → הדבק את הכתובת

### שלב 6: יצירת אדמין ראשון

1. נכנס לאתר והירשם עם המייל שלך
2. Firebase Console → **Firestore Database** → אוסף `users` → המסמך שלך
3. ערוך את השדה `isAdmin` ל-`true`
4. רענן את האתר - תופיע לך לשונית "ניהול"

---

## 🎮 איך משתמשים

### בתור אדמין
1. **ניהול → משחקים → + הוסף משחק** - הגדר קבוצות, יחס נקודות (סה"כ 15), זמן בעיטה
2. **קביעת תוצאה** - אחרי שהמשחק הסתיים, לחץ "קבע תוצאה". המערכת:
   - יוצרת הימור אוטומטי לכל מי ששכח
   - מחשבת את הניקוד לכולם
   - מעדכנת את כל הטבלאות
3. **הימורי לייב** - הגדר אתגר עם יחס וזמן סגירה
4. **דו-קרבים** - הכרע מנצח כשהדו-קרב מסתיים

### בתור שחקן
1. **משחקים** - הזן תוצאות עד 24 שעות לפני המשחק
2. **לייב** - בחר כמה נקודות להשקיע (מהמאזן הזמין)
3. **דו-קרב** - פתח אתגר חופשי או קבל אתגר של אחר
4. **טבלאות** - לחץ על שחקן כדי לראות את הפגיעות שלו (רק אחרי שמשחקים ננעלים)

---

## 🛠️ פיתוח מקומי

```bash
npm install
cp .env.example .env.local
# מלא את .env.local עם פרטי Firebase שלך
npm run dev
```

האתר ירוץ על `http://localhost:5173`

---

## 📁 מבנה הפרויקט

```
mundial-bets/
├── src/
│   ├── App.jsx                 # הקומפוננטה הראשית עם ניווט
│   ├── main.jsx                # נקודת כניסה של React
│   ├── styles.css              # כל העיצוב
│   ├── firebase/config.js      # חיבור ל-Firebase
│   ├── contexts/AuthContext    # ניהול משתמש ופרופיל
│   ├── pages/
│   │   ├── AuthScreen          # התחברות והרשמה
│   │   ├── MatchesPage         # ניחושי משחקים
│   │   ├── LiveBetsPage        # הימורי לייב
│   │   ├── DuelsPage           # דו-קרבים
│   │   ├── LeaderboardPage     # 4 טבלאות
│   │   ├── ProfilePage         # אזור אישי
│   │   └── AdminPage           # ניהול
│   ├── components/UserDetailModal  # פירוט שחקן
│   └── utils/
│       ├── constants.js        # קבועי משחק
│       └── scoring.js          # חישוב נקודות
├── firestore.rules             # ⚠️ חוקי אבטחה - חיוני!
├── firestore.indexes.json
├── firebase.json
├── netlify.toml
├── vite.config.js
└── package.json
```

---

## ⚠️ הערות אבטחה חשובות

1. **חוקי Firestore חייבים להיות מותקנים** - בלי זה, כל אחד יכול לראות הימורים של כולם ולשנות נקודות.
2. **משתני סביבה ב-Netlify** - אל תוסיף את `.env.local` ל-Git.
3. **אדמין ידני** - אין דרך להפוך מישהו לאדמין מהאפליקציה בלי שיש כבר אדמין. ההגדרה הראשונית חייבת להיות דרך Firestore Console.
4. **הימור אוטומטי** מתבצע רק כשהאדמין סוגר את המשחק (קובע תוצאה). זה מבטיח שהוא רץ פעם אחת בלבד לכל משתמש לכל משחק.

---

## 🎯 פיצ'רים עתידיים (לא מומשו)

- המלצת יחסים אוטומטית לאדמין דרך API חיצוני (סוקר בקלות וסוקר.ai וכו')
- התראות Push לפני סגירת משחק
- שיתוף תוצאות בוואטסאפ/טלגרם
- פילטור מתקדם של הימורי לייב לפי משחקים

בהצלחה במונדיאל! ⚽🏆
