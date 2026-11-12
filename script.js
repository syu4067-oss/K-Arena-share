import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";


// ========================================
// Firebase設定
// ========================================
//
// Firebase Console
// ↓
// プロジェクトの設定
// ↓
// マイアプリ
// ↓
// Webアプリ
// ↓
// firebaseConfig
//
// のコードをここにそのまま貼り付けてください。
// ========================================

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyChY_fLIShNn9xgcx4XHZ41myt-iuPwRNE",
  authDomain: "k-arena-share.firebaseapp.com",
  projectId: "k-arena-share",
  storageBucket: "k-arena-share.firebasestorage.app",
  messagingSenderId: "817198256422",
  appId: "1:817198256422:web:c62a13d1e280caa92631e7",
  measurementId: "G-W0Y69HVLNV"
};


// Firebaseを初期化
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);


// ========================================
// 座席マップ設定
// ========================================

const PAGE_SIZE = 1800;

const X_OFFSET = 27;
const Y_OFFSET = -37;


// ========================================
// HTML要素
// ========================================

const nameInput = document.getElementById("name");
const levelInput = document.getElementById("level");
const rowInput = document.getElementById("row");
const seatInput = document.getElementById("seat");

const addButton = document.getElementById("addButton");
const nameToggleButton = document.getElementById("nameToggleButton");

const message = document.getElementById("message");

const pins = document.getElementById("pins");
const memberList = document.getElementById("memberList");


// ========================================
// 座席データ
// ========================================

const SEATS = {
    1: new Map(),
    3: new Map(),
    5: new Map(),
    7: new Map()
};

for (const level of Object.keys(SEAT_DATA)) {

    for (const seat of SEAT_DATA[level]) {

        const row = seat[0];
        const number = seat[1];

        const x = seat[2];
        const y = seat[3];

        SEATS[level].set(
            `${row}-${number}`,
            { x, y }
        );
    }
}


// ========================================
// アプリの状態
// ========================================

let members = [];

let showNames = false;

let currentUser = null;


// ========================================
// 名前表示ON/OFF
// ========================================

nameToggleButton.addEventListener("click", () => {

    showNames = !showNames;

    nameToggleButton.textContent =
        showNames
            ? "名前表示：ON"
            : "名前表示：OFF";

    displayMembers();
});


// ========================================
// Firebase匿名ログイン
// ========================================

signInAnonymously(auth)
    .catch((error) => {

        console.error("匿名ログインエラー:", error);

        showMessage(
            "Firebaseへの接続に失敗しました"
        );
    });


onAuthStateChanged(auth, (user) => {

    if (!user) {
        return;
    }

    currentUser = user;

    console.log(
        "Firebaseログイン成功:",
        currentUser.uid
    );

    startRealtimeListener();
});


// ========================================
// Firestoreリアルタイム監視
// ========================================

function startRealtimeListener() {

    const participantsRef =
        collection(db, "participants");

    onSnapshot(
        participantsRef,

        (snapshot) => {

            members = [];

            snapshot.forEach((docSnapshot) => {

                const data = docSnapshot.data();

                members.push({
                    id: docSnapshot.id,
                    ...data
                });
            });


            // LEVEL → 列 → 座席番号の順で並べる

            members.sort((a, b) => {

                if (Number(a.level) !== Number(b.level)) {
                    return Number(a.level) - Number(b.level);
                }

                if (Number(a.row) !== Number(b.row)) {
                    return Number(a.row) - Number(b.row);
                }

                return Number(a.seat) - Number(b.seat);
            });


            displayMembers();
        },

        (error) => {

            console.error(
                "Firestore読み込みエラー:",
                error
            );

            showMessage(
                "参加者データを読み込めませんでした"
            );
        }
    );
}


// ========================================
// 座席登録
// ========================================

addButton.addEventListener("click", async () => {

    if (!currentUser) {

        showMessage(
            "Firebaseに接続中です。少し待ってください"
        );

        return;
    }


    const name =
        nameInput.value.trim();

    const level =
        levelInput.value;

    const row =
        Number(rowInput.value);

    const seat =
        Number(seatInput.value);


    // 名前チェック

    if (!name) {

        showMessage(
            "名前を入力してください"
        );

        return;
    }


    // 列・座席番号チェック

    if (!row || !seat) {

        showMessage(
            "列と座席番号を入力してください"
        );

        return;
    }


    // 座席データ検索

    const key =
        `${row}-${seat}`;

    const position =
        SEATS[level].get(key);


    if (!position) {

        showMessage(
            `LEVEL ${level} の ${row}列 ${seat}番は見つかりません`
        );

        return;
    }


    // ------------------------------------
    // 座席ごとに固定IDを作る
    // ------------------------------------

    const participantId =
        `${level}-${row}-${seat}`;


    try {

        addButton.disabled = true;

        addButton.textContent =
            "登録中...";


        const participantRef =
            doc(
                db,
                "participants",
                participantId
            );


        await setDoc(
            participantRef,
            {
                name: name,

                level: level,

                row: row,

                seat: seat,

                x: position.x,

                y: position.y,

                ownerId: currentUser.uid,

                createdAt: serverTimestamp()
            }
        );


        showMessage(
            "座席を登録しました"
        );


        // 入力欄を空にする

        nameInput.value = "";

        rowInput.value = "";

        seatInput.value = "";


    } catch (error) {

        console.error(
            "座席登録エラー:",
            error
        );


        if (
            error.code ===
            "permission-denied"
        ) {

            showMessage(
                "この座席はすでに他の人が登録しています"
            );

        } else {

            showMessage(
                "座席の登録に失敗しました"
            );
        }


    } finally {

        addButton.disabled = false;

        addButton.textContent =
            "座席を登録";
    }
});


// ========================================
// 参加者表示
// ========================================

function displayMembers() {

    memberList.innerHTML = "";

    pins.innerHTML = "";


    for (const member of members) {

        // ----------------------------
        // 参加者一覧
        // ----------------------------

        const li =
            document.createElement("li");

        li.className =
            "member";


        const info =
            document.createElement("div");

        info.className =
            "member-info";


        const name =
            document.createElement("div");

        name.className =
            "member-name";

        name.textContent =
            member.name;


        const seat =
            document.createElement("div");

        seat.className =
            "member-seat";

        seat.textContent =
            `LEVEL ${member.level}　${member.row}列 ${member.seat}番`;


        info.appendChild(name);

        info.appendChild(seat);


        // ----------------------------
        // 削除ボタン
        // ----------------------------

        const deleteButton =
            document.createElement("button");

        deleteButton.textContent =
            "削除";

        deleteButton.className =
            "delete-button";


        // 自分が登録した座席だけ削除可能

        if (
            member.ownerId ===
            currentUser?.uid
        ) {

            deleteButton.addEventListener(
                "click",
                () => deleteMember(member)
            );

        } else {

            deleteButton.style.display =
                "none";
        }


        li.appendChild(info);

        li.appendChild(deleteButton);

        memberList.appendChild(li);


        // ----------------------------
        // ピン表示
        // ----------------------------

        createPin(member);
    }
}


// ========================================
// 参加者削除
// ========================================

async function deleteMember(member) {

    if (!currentUser) {
        return;
    }


    if (
        member.ownerId !==
        currentUser.uid
    ) {

        showMessage(
            "自分が登録した座席だけ削除できます"
        );

        return;
    }


    const confirmed =
        confirm(
            `${member.name}さんの座席を削除しますか？`
        );


    if (!confirmed) {
        return;
    }


    try {

        await deleteDoc(
            doc(
                db,
                "participants",
                member.id
            )
        );


        showMessage(
            "座席を削除しました"
        );


    } catch (error) {

        console.error(
            "削除エラー:",
            error
        );

        showMessage(
            "座席の削除に失敗しました"
        );
    }
}


// ========================================
// ピン作成
// ========================================

function createPin(member) {

    const pin =
        document.createElement("div");

    pin.className =
        "pin";


    // 座席位置

    const xPercent =
        (member.x + X_OFFSET)
        / PAGE_SIZE
        * 100;

    const yPercent =
        (member.y + Y_OFFSET)
        / PAGE_SIZE
        * 100;


    pin.style.left =
        `${xPercent}%`;

    pin.style.top =
        `${yPercent}%`;


    // ピンの中の頭文字

    const text =
        document.createElement("span");

    text.textContent =
        member.name.substring(0, 1);

    pin.appendChild(text);


    // 名前表示

    const nameLabel =
        document.createElement("div");

    nameLabel.className =
        "pin-name";

    nameLabel.textContent =
        member.name;


    if (showNames) {

        nameLabel.classList.add(
            "show"
        );
    }


    pin.appendChild(nameLabel);


    // マウスを乗せたときの説明

    pin.title =
        `${member.name} / LEVEL ${member.level} / ${member.row}列 ${member.seat}番`;


    pins.appendChild(pin);
}


// ========================================
// メッセージ
// ========================================

function showMessage(text) {

    message.textContent =
        text;


    setTimeout(() => {

        message.textContent =
            "";

    }, 3000);
}


// ========================================
// 初期表示
// ========================================

displayMembers();