// ==========================================
// 1. OYUN NESNELERİ VE DÜNYA
// ==========================================
const player = { x: 1, y: 1, hp: 100, maxHp: 100, damage: 16, potions: 3 };

const enemies = [
    { id: 0, name: "Froggit", x: 5, y: 5, hp: 50, maxHp: 50, damage: 12, friendliness: 0, isAlive: true },
    { id: 1, name: "Whimsun", x: 8, y: 7, hp: 40, maxHp: 40, damage: 10, friendliness: 0, isAlive: true },
    { id: 2, name: "Vegetoid", x: 4, y: 13, hp: 65, maxHp: 65, damage: 15, friendliness: 0, isAlive: true }
];

// NPC Listesi ve Yenilenen Hikaye Cümleleri
const npcs = [
    { 
        x: 1, y: 4, 
        name: "Gerson", 
        dialogueLines: [
            "* Hey evlat! Burası tehlikeli bir bölge.",
            "* İleride tek bir giriş kapısı var, dokunduğunda açılacaktır.",
            "* Sisin ardındaki aydınlık odayı keşfetmeye hazır mısın?",
            "* Kararlılığını asla kaybetme..."
        ]
    },
    {
        x: 11, y: 3,
        name: "Gaster'ın Çırağı",
        dialogueLines: [
            "* Ah... Sonunda kapıyı açıp buraya gelebilen biri çıktı.",
            "* Burası Sisin Ötesindeki... Işığın hiç sönmediği kutsal bir odaydı.",
            "* Ama çok uzun zaman önce buraya gelmiş birisi tarafından kilitlendi", 
            "* ve o günden beri kimse giremedi.",
            "* Ama sen bizi kurtardın ve buraya gelmeyi başardın,",
            "* Sana minnettarız..."
        ]
    }
];

const items = [
    { x: 1, y: 13 },
    { x: 11, y: 11 },
    { x: 13, y: 5 }
];

// Kapı aydınlık odanın tek girişi olan x: 8, y: 7 konumuna yerleştirildi
let lockedDoors = [{ x: 8, y: 7, id: "door1" }];

// Sağ taraftaki odanın görünürlük kilidi
let isDoorOpened = false; 

let activeEnemy = null;
let activeNpc = null;
let currentLineIndex = 0;
let gameState = "EXPLORE"; 
const viewDistance = 6;

let dialogueTimeout = null;
let isTyping = false;

// Harita tamamen izole edildi; aydınlık odanın etrafı aşılmaz duvarlarla örüldü
const grid = [
    "###############",
    "#......#......#",
    "#.####.#.####.#",
    "#.#....#....#.#",
    "#.#.####.##.#.#",
    "#.#....#....#.#",
    "#.####.#.##.#.#",
    "#.......K.....#", 
    "######.#.##.#.#",
    "#....#.#....#.#",
    "#.##.#.#.##.#.#",
    "#.#..#.#....#.#",
    "#.#.##.#.####.#",
    "#......#......#", // Bu satırdaki kapalı duvarlar temizlendi
    "###############"
];
const height = grid.length;
const width = grid[0].length;

// DOM Elemanları
const mapElement = document.getElementById("game-map");
const exploreMode = document.getElementById("explore-mode");
const battleMode = document.getElementById("battle-mode");
const logElement = document.getElementById("battle-log");
const spareBtn = document.getElementById("spare-btn");
const itemBtn = document.getElementById("item-btn");
const enemyNameTag = document.getElementById("enemy-name");
const dialogueBox = document.getElementById("dialogue-box");
const dialogueText = document.getElementById("dialogue-text");

// ==========================================
// 2. HARİTA RENDER VE SİS SİSTEMİ
// ==========================================
function drawMap() {
    mapElement.innerHTML = "";
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const tile = document.createElement("div");
            tile.classList.add("tile");

            const distance = Math.sqrt(Math.pow(player.x - j, 2) + Math.pow(player.y - i, 2));
            const isBrightRoom = j >= 8;

            // Kapı açılmadıysa sağ taraf tamamen görünmez kalır
            if (isBrightRoom && isDoorOpened) {
                tile.classList.add("bright-tile");
            } else if (distance > viewDistance) {
                tile.classList.add("fog");
            } else {
                tile.classList.add("floor");
                tile.textContent = "·"; 
            }

            const hasEnemy = enemies.find(e => e.isAlive && e.x === j && e.y === i);
            const hasItem = items.find(it => it.x === j && it.y === i);
            const hasNpc = npcs.find(n => n.x === j && n.y === i);
            const isLockedDoor = lockedDoors.find(d => d.x === j && d.y === i);

            const shouldHideInBrightRoom = isBrightRoom && !isDoorOpened;

            if (i === player.y && j === player.x) {
                tile.classList.add("player");
                if (player.hp <= player.maxHp * 0.3) tile.classList.add("low-hp");
            } else if (!shouldHideInBrightRoom && hasEnemy) {
                tile.classList.add("enemy");
                tile.textContent = "☠️"; 
            } else if (!shouldHideInBrightRoom && hasNpc) {
                tile.classList.add("npc");
                tile.textContent = "🐢";
            } else if (!shouldHideInBrightRoom && hasItem) {
                tile.classList.add("item-tile");
                tile.textContent = "🧪";
            } else if (isLockedDoor) {
                tile.classList.add("locked-door");
                tile.textContent = "🔒";
            } else if (grid[i][j] === '#') {
                if (distance <= viewDistance || (isBrightRoom && isDoorOpened)) {
                    tile.classList.add("wall");
                } else {
                    tile.classList.add("fog");
                }
            }
            mapElement.appendChild(tile);
        }
    }
    document.getElementById("player-hp").textContent = `${player.hp}/${player.maxHp}`;
    document.getElementById("potions-count").textContent = player.potions;
}

// ==========================================
// 3. HAREKET VE OTOMATİK KAPI SİSTEMİ
// ==========================================
function movePlayer(dx, dy) {
    if (gameState !== "EXPLORE") return;

    const nextX = player.x + dx;
    const nextY = player.y + dy;

    if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) return;

    // Kapıya çarptığı an otomatik açılır
    const encounteredDoor = lockedDoors.find(d => d.x === nextX && d.y === nextY);
    if (encounteredDoor) {
        openTheDoor(encounteredDoor);
        return; 
    }

    if (grid[nextY][nextX] !== '#') {
        player.x = nextX;
        player.y = nextY;

        const itemIndex = items.findIndex(it => it.x === player.x && it.y === player.y);
        if (itemIndex !== -1) {
            player.potions++;
            items.splice(itemIndex, 1);
        }

        const encounteredNpc = npcs.find(n => n.x === player.x && n.y === player.y);
        if (encounteredNpc) {
            startDialogue(encounteredNpc);
            return;
        }

        const encounteredEnemy = enemies.find(e => e.isAlive && e.x === player.x && e.y === player.y);
        if (encounteredEnemy) {
            startBattle(encounteredEnemy);
        }
    }
    drawMap();
}

function openTheDoor(doorObj) {
    isDoorOpened = true; 
    lockedDoors = lockedDoors.filter(d => d.id !== doorObj.id);
    alert("Kapı büyük bir gürültüyle açıldı! Sisin ötesindeki oda tamamen aydınlanıyor...");
    drawMap();
}

// ==========================================
// 4. DAKTİLO DİYALOG SİSTEMİ
// ==========================================
function typeWriter(text, index = 0) {
    if (index < text.length) {
        isTyping = true;
        dialogueText.textContent += text.charAt(index);
        dialogueTimeout = setTimeout(() => typeWriter(text, index + 1), 30);
    } else {
        isTyping = false;
    }
}

function startDialogue(npcObj) {
    gameState = "DIALOGUE";
    activeNpc = npcObj;
    currentLineIndex = 0; 
    dialogueBox.classList.remove("hidden");
    dialogueText.textContent = "";
    typeWriter(activeNpc.dialogueLines[currentLineIndex]);
}

function handleDialogueAdvance() {
    if (isTyping) {
        clearTimeout(dialogueTimeout);
        dialogueText.textContent = activeNpc.dialogueLines[currentLineIndex];
        isTyping = false;
        return;
    }

    currentLineIndex++;
    if (currentLineIndex < activeNpc.dialogueLines.length) {
        dialogueText.textContent = "";
        typeWriter(activeNpc.dialogueLines[currentLineIndex]);
    } else {
        endDialogue();
    }
}

function endDialogue() {
    gameState = "EXPLORE";
    dialogueBox.classList.add("hidden");
    if (activeNpc.name === "Gerson") {
        player.y += 1;
    } else {
        player.x -= 1; 
    }
    activeNpc = null;
    drawMap();
}

// ==========================================
// 5. SAVAŞ SİSTEMİ
// ==========================================
function startBattle(enemyObj) {
    gameState = "BATTLE";
    activeEnemy = enemyObj;
    exploreMode.classList.add("hidden");
    battleMode.classList.remove("hidden");
    spareBtn.disabled = true;
    enemyNameTag.style.color = "#ffffff";
    enemyNameTag.textContent = `${activeEnemy.name}`;
    updateBattleUI();
    logElement.innerHTML = `* ${activeEnemy.name} belirdi!<br>* İçinizdeki kararlılık kıvılcımlanıyor.`;
}

function updateBattleUI() {
    document.getElementById("battle-player-hp").textContent = player.hp;
    document.getElementById("enemy-hp").textContent = activeEnemy.hp;
    itemBtn.textContent = `Eşya (${player.potions})`;
    document.getElementById("player-hp-bar").style.width = `${(player.hp / player.maxHp) * 100}%`;
    document.getElementById("enemy-hp-bar").style.width = `${(activeEnemy.hp / activeEnemy.maxHp) * 100}%`;
}

function playerAttack() {
    if (gameState !== "BATTLE") return;

    const hitQuality = Math.random(); 
    let finalDamage = player.damage;
    let hitText = "";

    if (hitQuality > 0.8) {
        finalDamage = Math.round(player.damage * 1.5); 
        hitText = `<span style='color:#f1c40f;'>* MÜKEMMEL VURUŞ! CRITICAL!</span>`;
    } else if (hitQuality < 0.2) {
        finalDamage = Math.round(player.damage * 0.6); 
        hitText = `* Sıyırdın! Zayıf vuruş.`;
    } else {
        hitText = `* İsabetli bir vuruş!`;
    }

    activeEnemy.hp -= finalDamage;
    if (activeEnemy.hp < 0) activeEnemy.hp = 0;
    logElement.innerHTML = `${hitText}<br>* ${activeEnemy.name} ${finalDamage} hasar aldı.`;
    updateBattleUI();

    if (activeEnemy.hp <= 0) {
        logElement.innerHTML += `<br>* Toza dönüştü... ${activeEnemy.name} yenildi.`;
        activeEnemy.isAlive = false;
        gameState = "VICTORY";
        return;
    }
    enemyTurn();
}

function playerAct() {
    if (gameState !== "BATTLE") return;
    if (activeEnemy.friendliness < 3) activeEnemy.friendliness++;
    if (activeEnemy.friendliness === 1) {
        logElement.innerHTML = `* ${activeEnemy.name} ile konuşmaya çalıştın. Şüpheyle bakıyor.`;
    } else if (activeEnemy.friendliness === 2) {
        logElement.innerHTML = `* Ona dostça gülümsedin. Saldırı isteği azalıyor gibi.`;
    } else if (activeEnemy.friendliness >= 3) {
        spareBtn.disabled = false;
        enemyNameTag.style.color = "#f1c40f";
        logElement.innerHTML = `* ${activeEnemy.name} artık seninle savaşmak istemiyor!<br><span style='color:#f1c40f;'>* Onu BAĞIŞLAYABİLİRSİN.</span>`;
    }
    enemyTurn();
}

function playerUseItem() {
    if (gameState !== "BATTLE") return;
    if (player.potions > 0) {
        if (player.hp === player.maxHp) { logElement.innerHTML = "* Canın zaten tamamen dolu!"; return; }
        player.potions--;
        player.hp += 40;
        if (player.hp > player.maxHp) player.hp = player.maxHp;
        logElement.innerHTML = "* İksiri içtin! 40 HP yenilendi.";
        updateBattleUI();
        enemyTurn();
    } else { logElement.innerHTML = "* Hiç iksirin kalmadı!"; }
}

function playerSpare() {
    if (gameState !== "BATTLE" || activeEnemy.friendliness < 3) return;
    logElement.innerHTML = `* ${activeEnemy.name} canavarını BAĞIŞLADIN.`;
    activeEnemy.isAlive = false;
    gameState = "VICTORY";
}

function enemyTurn() {
    setTimeout(() => {
        if (gameState !== "BATTLE") return;

        let finalDamage = activeEnemy.damage;
        if (activeEnemy.friendliness >= 3) {
            logElement.innerHTML += `<br>* ${activeEnemy.name} huzurla bekliyor.`;
            return;
        }

        player.hp -= finalDamage;
        if (player.hp < 0) player.hp = 0;
        logElement.innerHTML += `<br>* ${activeEnemy.name} saldırdı! ${finalDamage} hasar aldın.`;
        
        let statusText = "";
        if (activeEnemy.hp <= activeEnemy.maxHp * 0.3) {
            statusText = `<br><span style='color:#e74c3c;'>* ${activeEnemy.name} titriyor, canı çok az!</span>`;
        } else if (activeEnemy.friendliness === 2) {
            statusText = `<br>* ${activeEnemy.name} sanki sakinleşiyor.`;
        } else {
            const randomLogs = [
                `<br>* Hava zindan kokusuyla doluyor.`,
                `<br>* ${activeEnemy.name} bir sonraki hamlesini düşünüyor.`,
                `<br>* İçindeki kararlılık hissi seni ayakta tutuyor.`
            ];
            statusText = randomLogs[Math.floor(Math.random() * randomLogs.length)];
        }
        
        logElement.innerHTML += statusText;
        updateBattleUI();

        if (player.hp <= 0) {
            document.getElementById("battle-title").textContent = "💔 OYUN BİTTİ";
            logElement.innerHTML = "* Dünyan karardı... Ama bu bir son değil.";
            gameState = "GAME_OVER";
            drawMap();
        }
    }, 1000);
}

// ==========================================
// 6. GİRDİLER VE TETİKLEYİCİLER
// ==========================================
window.addEventListener("keydown", (event) => {
    const key = event.key;
    const keyLower = key.toLowerCase();

    if (gameState === "EXPLORE") {
        if (keyLower === 'w') movePlayer(0, -1);
        if (keyLower === 's') movePlayer(0, 1);
        if (keyLower === 'a') movePlayer(-1, 0);
        if (keyLower === 'd') movePlayer(1, 0);
    } 
    else if (gameState === "DIALOGUE") {
        if (key === "Enter" || key === " ") handleDialogueAdvance();
    }
    else if (gameState === "BATTLE") {
        if (keyLower === 'z') playerAttack();
        if (keyLower === 'c') playerAct();
        if (keyLower === 'b') playerUseItem();
        if (keyLower === 'v' && !spareBtn.disabled) playerSpare();
        if (keyLower === 'x') playerSpare(); // Kaçma simülasyonu için bağışlama tetiği kullanılabilir
    }
    else if (gameState === "VICTORY") {
        gameState = "EXPLORE";
        battleMode.classList.add("hidden");
        exploreMode.classList.remove("hidden");
        activeEnemy = null;
        drawMap();
    }
});

document.getElementById("attack-btn").addEventListener("click", playerAttack);
document.getElementById("act-btn").addEventListener("click", playerAct);
document.getElementById("item-btn").addEventListener("click", playerUseItem);
document.getElementById("spare-btn").addEventListener("click", playerSpare);

function runAway() {
    logElement.innerHTML = "* Arkana bakmadan kaçtın!";
    setTimeout(() => { player.x -= 1; gameState = "EXPLORE"; battleMode.classList.add("hidden"); exploreMode.classList.remove("hidden"); activeEnemy = null; drawMap(); }, 600);
}
document.getElementById("run-btn").addEventListener("click", runAway);

// İlk Harita Çizimi
drawMap();