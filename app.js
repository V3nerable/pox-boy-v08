        // VIRTUAL KEYBOARD LOGIC
        let activeVkTarget = null;
        let vkCursorPos = 0;

        function openVk(elementId) {
            activeVkTarget = document.getElementById(elementId);
            if (!activeVkTarget) return;

            // Mask password characters if we are editing the auth code
            // (single-line deck only; the growing deck is never a secret)
            const inputEl = document.getElementById('vk-input');
            inputEl.type = (activeVkTarget.type === 'password') ? 'password' : 'text';

            // v0.45: the keyboard now shows its OWN growing field for long-form targets --
            // before this, the composer textarea grew BEHIND the keyboard overlay where no
            // one could see it, while the visible deck stayed a single scrolling line
            const multiEl = document.getElementById('vk-multi');
            const isMulti = !!(activeVkTarget.classList && activeVkTarget.classList.contains('grow'));
            inputEl.style.display = isMulti ? 'none' : '';
            multiEl.style.display = isMulti ? 'block' : 'none';

            const displayEl = isMulti ? multiEl : inputEl;
            displayEl.value = activeVkTarget.value;
            vkCursorPos = activeVkTarget.value.length;

            document.getElementById('keyboard-modal').style.display = 'flex';
            // growth is seated AFTER the modal is visible: scrollHeight reads 0 while hidden
            autoGrowEl(displayEl);
            autoGrowEl(activeVkTarget);
        }

        // v0.44: message field grows UPWARD as it fills (instead of hiding overflow),
        // capped at 40vh so the keyboard + buttons never leave the screen
        function autoGrowEl(el) {
            if (!el || !el.classList || !el.classList.contains('grow')) return;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, Math.floor(window.innerHeight * 0.4)) + 'px';
        }

        // v0.45: which on-keyboard deck is live -- the growing multi-line deck for
        // long-form targets (.grow), the single-line input for everything else
        function vkDisplayEl() {
            const multi = activeVkTarget && activeVkTarget.classList && activeVkTarget.classList.contains('grow');
            return document.getElementById(multi ? 'vk-multi' : 'vk-input');
        }

        function vkPress(char) {
            const input = vkDisplayEl();
            const val = input.value;
            input.value = val.slice(0, vkCursorPos) + char + val.slice(vkCursorPos);
            vkCursorPos++;

            // Auto update target so passwords look responsive
            if (activeVkTarget) activeVkTarget.value = input.value;
            autoGrowEl(input);          // v0.45: the VISIBLE deck stretches too
            autoGrowEl(activeVkTarget); // v0.44: composer behind mirrors content size
        }

        function vkBackspace() {
            const input = vkDisplayEl();
            const val = input.value;
            if (vkCursorPos > 0) {
                input.value = val.slice(0, vkCursorPos - 1) + val.slice(vkCursorPos);
                vkCursorPos--;
            }
            if (activeVkTarget) activeVkTarget.value = input.value;
            autoGrowEl(input);
            autoGrowEl(activeVkTarget);
        }

        // ENTER = DONE (Telegram spec: text auto-wraps, no manual line-break key)
        function vkConfirm() {
            if (activeVkTarget) {
                activeVkTarget.value = vkDisplayEl().value;
                autoGrowEl(activeVkTarget);
            }
            vkCancel();
        }

        function vkCancel() {
            document.getElementById('keyboard-modal').style.display = 'none';
            activeVkTarget = null;
        }

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(()=>{}); });

            // When a new service worker takes control (after a deploy), reload ONCE so the
            // page can never run a mix of old-cache and new-cache files (the frankenbuild
            // that made the v0.22 fullscreen fix appear broken while the camera fix worked).
            let swReloading = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (swReloading) return;
                swReloading = true;
                window.location.reload();
            });
        }

        // 1. Initialize state variables FIRST
        const storedItems = localStorage.getItem('pipboy-items');
        const storedQuests = localStorage.getItem('pipboy-quests');
        const storedUser = localStorage.getItem('pipboy-user');
        const storedFactions = localStorage.getItem('pipboy-factions');

        let userProfile = storedUser ? JSON.parse(storedUser) : {
            isInitiated: false,
            name: "UNKNOWN",
            maxHp: 100,
            rads: 0,
            origin: null,
            trait: null,
            hasCalculatedBaseSpecial: false,
            special: { S: 1, P: 1, E: 1, C: 1, I: 1, A: 1, L: 1 },
            perk: null
        };
        // Backwards compatibility check for old saves
        if (userProfile.rads === undefined) userProfile.rads = 0;

        // v0.67: Glowing One state
        let isGlowingOne = localStorage.getItem('pipboy-glowing-one') === 'true';
        let glowingOneChecked = localStorage.getItem('pipboy-glowing-one-checked') === 'true';

        let items = storedItems ? JSON.parse(storedItems) : [
            { id: 1, name: "10MM PISTOL", type: "weapons", effects: "DMG: 18", quantity: 1, equipped: true },
            { id: 4, name: "DRINK TICKET", type: "aid", effects: "Restores Thirst", quantity: 2, equipped: false }
        ];
        
        let quests = storedQuests ? JSON.parse(storedQuests) : [
            { id: 1, name: "THE GATHERING", type: "MAIN", giver: "VAULT-TEC SURVIVORS", location: "VENUE ENTRANCE", timeStr: "--:--", expireTime: null, objectives: ["Find the venue entrance.", "Check in with Overseer."], completed: false, expired: false, abandoned: false },
            { id: 2, name: "SCAVENGER HUNT", type: "SIDE", giver: "SCAVENGERS GUILD", location: "BAR AREA", timeStr: "23:59", expireTime: new Date().setHours(23, 59, 59, 999), objectives: ["Locate 3 hidden Nuka-Colas", "Return to bartender for prize"], completed: false, expired: false, abandoned: false }
        ];

        let factions = storedFactions ? JSON.parse(storedFactions) : [
            { id: 1, name: "THE WAR BOYS", rep: 25, leader: "Immortan Joe", blurb: "Cult fanatical foot soldiers loyal to the Immortan.", bio: "Raised from birth to serve the Immortan, these pale warriors live half-lives, sustained by bloodbags and the promise of Valhalla.", members: ["Slit", "Nux", "Morsov", "Rictus Erectus"] },
            { id: 2, name: "SCAVENGERS GUILD", rep: 60, leader: "The Keeper of the Scales", blurb: "Nomads who trade pre-war junk for water and guzzoline.", bio: "Wandering merchants and scrappers. They hold no allegiance except to the highest bidder and the promise of survival.", members: ["The Merchant", "Scrap-Iron", "Rust"] },
            { id: 3, name: "THE BUZZARDS", rep: -20, leader: "Unknown", blurb: "Spiky, Russian-speaking raiders who prowl the wastes.", bio: "Vicious scavengers known for driving spike-covered vehicles. They attack unprovoked and take no prisoners.", members: ["Buzzard 1", "Buzzard 2"] },
            { id: 4, name: "VAULT-TEC SURVIVORS", rep: 0, leader: "The Overseer", blurb: "Tunnel-dwellers who recently surfaced with high-tech gear.", bio: "Emerged from the deep underground bunkers. They have pristine jumpsuits and zero understanding of how the wasteland actually works.", members: ["Vault Boy", "Gary 1", "Gary 2"] }
        ];

        // v0.59: DEFAULT WAYPOINTS with version-based merge for existing users
        const DEFAULT_WAYPOINTS = [
            { id: 101, name: "VIP LOUNGE", lat: -31.9505, lng: 115.8605, discovered: false },
            { id: 102, name: "NUKA-COLA BAR", lat: -31.9515, lng: 115.8615, discovered: false }
        ];
        const WAYPOINT_VERSION = 1; // bump this when adding new default waypoints

        let waypoints = JSON.parse(localStorage.getItem('pipboy-waypoints')) || DEFAULT_WAYPOINTS;

        // Merge new default waypoints for existing users who already have a waypoint list
        (function mergeWaypoints() {
            const savedVer = parseInt(localStorage.getItem('pipboy-wp-version') || '0', 10);
            if (savedVer < WAYPOINT_VERSION && localStorage.getItem('pipboy-waypoints')) {
                const existingNames = new Set(waypoints.map(w => w.name));
                DEFAULT_WAYPOINTS.forEach(dw => {
                    if (!existingNames.has(dw.name)) waypoints.push({...dw, id: Date.now() + Math.floor(Math.random() * 10000)});
                });
                localStorage.setItem('pipboy-waypoints', JSON.stringify(waypoints));
            }
            localStorage.setItem('pipboy-wp-version', String(WAYPOINT_VERSION));
        })();

        let activeItemId = null;
        let currentInvTab = 'weapons';
        let currentStatTab = 'status'; // v0.53: STAT sub-pages now tracked (stats moved here)
        function statsPaneActive() {
            const st = document.getElementById('tab-stat');
            return !!(st && st.classList.contains('active') && currentStatTab === 'stats');
        }
        // v0.58: overseer tab active check (pariah/zone listeners re-render into this tab)
        function overseerPaneActive() {
            const st = document.getElementById('tab-stat');
            return !!(st && st.classList.contains('active') && currentStatTab === 'overseer');
        }
        let currentDataTab = 'quests';

        const themes = [
            { name: "GREEN", hex: "#1aff80", dim: "#0f8f48", rgb: "26, 255, 128",
              mapFx: "sepia(100%) hue-rotate(70deg) saturate(600%) brightness(1.1) contrast(1.2)",
              camFx: "sepia(100%) hue-rotate(85deg) saturate(300%) brightness(0.8) contrast(1.8)" },
            { name: "AMBER", hex: "#ffb642", dim: "#b37200", rgb: "255, 182, 66",
              mapFx: "sepia(100%) hue-rotate(-10deg) saturate(500%) brightness(1.05) contrast(1.2)",
              camFx: "sepia(100%) hue-rotate(-5deg) saturate(250%) brightness(0.8) contrast(1.7)" },
            { name: "BLUE", hex: "#42b6ff", dim: "#006bb3", rgb: "66, 182, 255",
              mapFx: "sepia(100%) hue-rotate(160deg) saturate(500%) brightness(1.05) contrast(1.2)",
              camFx: "sepia(100%) hue-rotate(170deg) saturate(280%) brightness(0.8) contrast(1.8)" },
            { name: "WHITE", hex: "#ffffff", dim: "#888888", rgb: "255, 255, 255",
              mapFx: "grayscale(100%) brightness(1.05) contrast(1.3)",
              camFx: "grayscale(90%) brightness(0.85) contrast(1.7)" },
            // v0.69: PDA theme (dev-only, S.T.A.L.K.E.R. style)
            { name: "PDA", hex: "#d4a574", dim: "#8b7355", rgb: "212, 165, 116",
              mapFx: "sepia(80%) hue-rotate(-20deg) saturate(150%) brightness(0.9) contrast(1.1)",
              camFx: "sepia(80%) hue-rotate(-20deg) saturate(150%) brightness(0.85) contrast(1.2)",
              pda: true }
        ];
        let currentThemeIndex = 0;

        function saveToStorage() {
            localStorage.setItem('pipboy-items', JSON.stringify(items));
            localStorage.setItem('pipboy-quests', JSON.stringify(quests));
            localStorage.setItem('pipboy-user', JSON.stringify(userProfile));
            localStorage.setItem('pipboy-waypoints', JSON.stringify(waypoints));
            localStorage.setItem('pipboy-factions', JSON.stringify(factions));
        }

        // ==================== FUN / WILD STATS (v0.57) ====================
        // Cumulative counters tracked for the STATS page. Some derive from existing data
        // (quests, rolodex, photos), others are incremented at relevant engine points.
        let funStats = {
            radsTotal: 0,        // lifetime rads absorbed (incremented in adjustRads for positive deltas)
            distance: 0,         // km travelled (incremented in GPS fix handler)
            geiger: 0,           // geiger burst count
            questsCompleted: 0,  // quests marked complete
            questsAbandoned: 0,  // quests abandoned
            steals: 0,           // steal-type quests completed
            fetches: 0,          // fetch-type quests completed
            assists: 0,          // assist-type quests completed
            nearDeath: 0,        // times HP dropped below 20%
            marches: 0,          // enclave marches endured (radio enclave track plays)
            regret: 0            // photographs deleted from databank
        };
        (function loadFunStats() {
            try {
                const saved = JSON.parse(localStorage.getItem('pipboy-funstats') || 'null');
                if (saved) { for (let k in saved) { if (funStats.hasOwnProperty(k)) funStats[k] = saved[k]; } }
                // v0.63: no more random pre-fill — all stats tracked from actual gameplay
            } catch (e) {}
        })();
        function saveFunStats() {
            try { localStorage.setItem('pipboy-funstats', JSON.stringify(funStats)); } catch (e) {}
        }
        function bumpFunStat(key, delta) {
            if (!funStats.hasOwnProperty(key)) return;
            funStats[key] = Math.max(0, (funStats[key] || 0) + (delta || 1));
            saveFunStats();
        }
        function renderFunStats() {
            // Derived stats (computed live from existing data)
            const el = (id) => document.getElementById(id);
            const qCompleted = quests.filter(q => q.completed).length;
            const daysPassed = Math.floor((Date.now() - (funStats._bootTime || Date.now())) / 86400000) || 0;
            const locations = waypoints.filter(w => w.discovered).length || 1;
            const txSent = (typeof mailLog !== 'undefined') ? mailLog.filter(m => m.dir === 'out').length : 0;
            const photos = (typeof photoArchive !== 'undefined') ? photoArchive.length : 0;
            const wastelandersMet = (typeof rolodex !== 'undefined') ? rolodex.length : 0;

            // Field status (from rad engine)
            const fsEl = el('fs-field-status');
            if (fsEl) {
                const fixAge = lastFixAt ? Math.max(0, Math.floor((Date.now() - lastFixAt) / 60000)) : null;
                const fieldTxt = radFieldActive ? ('INSIDE ' + (radFieldPariah || 'FIELD')) : (medShelterActive ? 'IN MED SHELTER' : 'OPEN WASTES');
                const fieldColor = radFieldActive ? '#ff3333' : (medShelterActive ? '#5fc98e' : 'inherit');
                fsEl.style.color = fieldColor;
                fsEl.innerText = 'FIELD STATUS: ' + fieldTxt + ' · LAST FIX ' + (fixAge === null ? 'NEVER' : fixAge + 'M AGO');
            }

            if (el('fs-locations')) el('fs-locations').innerText = locations;
            if (el('fs-days')) el('fs-days').innerText = daysPassed;
            if (el('fs-quests')) el('fs-quests').innerText = qCompleted;
            if (el('fs-wastelanders')) el('fs-wastelanders').innerText = wastelandersMet;
            if (el('fs-tx-sent')) el('fs-tx-sent').innerText = txSent;
            if (el('fs-photos')) el('fs-photos').innerText = photos;

            // Wild / cumulative stats
            if (el('fs-rads-total')) el('fs-rads-total').innerText = funStats.radsTotal;
            if (el('fs-distance')) el('fs-distance').innerText = (funStats.distance / 1000).toFixed(1) + ' KM';
            if (el('fs-quests-completed')) el('fs-quests-completed').innerText = funStats.questsCompleted;
            if (el('fs-quests-abandoned')) el('fs-quests-abandoned').innerText = funStats.questsAbandoned;
            if (el('fs-steals')) el('fs-steals').innerText = funStats.steals;
            if (el('fs-fetches')) el('fs-fetches').innerText = funStats.fetches;
            if (el('fs-assists')) el('fs-assists').innerText = funStats.assists;
            if (el('fs-neardth')) el('fs-neardth').innerText = funStats.nearDeath;
            if (el('fs-marches')) el('fs-marches').innerText = funStats.marches;
            if (el('fs-regret')) el('fs-regret').innerText = funStats.regret;
        }

        // ==================== MUTATIONS (v0.58) ====================
        // Double-edged S.P.E.C.I.A.L. modifiers gained randomly from radiation exposure.
        // Trigger: userProfile.rads >= 250 (current, not lifetime) → 10% chance per radDamageTick.
        // No cap — collect all 11. One clash pair: CARNIVORE/HERBIVORE can't coexist.
        // Removal: ONLY at decontamination stations (decon zone, once per entry).
        // Starched Genes perk: locks mutations permanently (decon can't strip).
        const MUTATIONS = [
            { id: 'egg_head', name: 'EGG HEAD', buff: {I:2}, debuff: {S:-2}, desc: '+2 INT / −2 STR' },
            { id: 'marsupial', name: 'MARSUPIAL', buff: {A:2}, debuff: {E:-2}, desc: '+2 AGI / −2 END' },
            { id: 'scaly', name: 'SCALY', buff: {E:2}, debuff: {C:-2}, desc: '+2 END / −2 CHA' },
            { id: 'adrenal', name: 'ADRENAL', buff: {S:2}, debuff: {L:-2}, desc: '+2 STR / −2 LCK' },
            { id: 'eagle_eyes', name: 'EAGLE EYES', buff: {P:2}, debuff: {A:-2}, desc: '+2 PER / −2 AGI' },
            { id: 'thick_skin', name: 'THICK SKIN', buff: {E:2}, debuff: {I:-2}, desc: '+2 END / −2 INT' },
            { id: 'glow_blood', name: 'GLOW BLOOD', buff: {L:2}, debuff: {P:-2}, desc: '+2 LCK / −2 PER' },
            { id: 'carnivore', name: 'CARNIVORE', buff: {S:2}, debuff: {C:-2}, desc: '+2 STR / −2 CHA', clashes: ['herbivore'] },
            { id: 'herbivore', name: 'HERBIVORE', buff: {E:2}, debuff: {S:-2}, desc: '+2 END / −2 STR', clashes: ['carnivore'] },
            { id: 'nightkin', name: 'NIGHTKIN', buff: {P:2}, debuff: {S:-2}, desc: '+2 PER / −2 STR' },
            { id: 'whisperer', name: 'WASTELAND WHISPERER', buff: {C:2}, debuff: {E:-2}, desc: '+2 CHA / −2 END' }
        ];
        let activeMutations = [];
        (function loadMutations() {
            try { activeMutations = JSON.parse(localStorage.getItem('pipboy-mutations') || '[]'); } catch (e) { activeMutations = []; }
        })();
        function saveMutations() {
            try { localStorage.setItem('pipboy-mutations', JSON.stringify(activeMutations)); } catch (e) {}
        }
        // Recompute userProfile.special from baseSpecial + active mutations
        function recomputeSpecial() {
            if (!userProfile.baseSpecial) userProfile.baseSpecial = {...userProfile.special}; // first-time snapshot
            const base = userProfile.baseSpecial;
            const eff = {...base};
            activeMutations.forEach(mid => {
                const m = MUTATIONS.find(x => x.id === mid);
                if (!m) return;
                for (let k in m.buff) eff[k] = (eff[k] || 1) + m.buff[k];
                for (let k in m.debuff) eff[k] = (eff[k] || 1) + m.debuff[k];
            });
            for (let k in eff) eff[k] = Math.max(1, Math.min(10, eff[k]));
            userProfile.special = eff;
        }
        function gainMutation() {
            const available = MUTATIONS.filter(m => {
                if (activeMutations.indexOf(m.id) !== -1) return false; // already have it
                if (m.clashes && m.clashes.some(c => activeMutations.indexOf(c) !== -1)) return false; // clash
                return true;
            });
            if (!available.length) return; // all collected or clashing
            const pick = available[Math.floor(Math.random() * available.length)];
            activeMutations.push(pick.id);
            recomputeSpecial();
            calculateSkills();
            saveMutations();
            saveToStorage();
            renderProfile();
            showNotification('☢ MUTATION GAINED: ' + pick.name + ' (' + pick.desc + ')');
        }
        function loseMutation(id) {
            const idx = activeMutations.indexOf(id);
            if (idx === -1) return;
            activeMutations.splice(idx, 1);
            recomputeSpecial();
            calculateSkills();
            saveMutations();
            saveToStorage();
            renderProfile();
            const m = MUTATIONS.find(x => x.id === id);
            showNotification('🧬 MUTATION LOST: ' + (m ? m.name : id));
        }
        function loseRandomMutation() {
            if (!activeMutations.length) return false;
            const pick = activeMutations[Math.floor(Math.random() * activeMutations.length)];
            loseMutation(pick);
            return true;
        }
        // Mutation roll — called from radDamageTick when rads >= 250
        // v0.58: 10-minute cooldown between gains (multi-day event pacing)
        let _lastMutationGain = 0;
        function rollMutation() {
            const now = Date.now();
            if (now - _lastMutationGain < 10 * 60 * 1000) return; // 10 min cooldown
            if (Math.random() < 0.10) {
                gainMutation();
                _lastMutationGain = now;
            }
        }

        // v0.58: render active mutations list in the SPECIAL sub-tab
        function renderMutations() {
            const section = document.getElementById('mutations-section');
            const list = document.getElementById('mutations-list-display');
            if (!section || !list) return;
            if (!activeMutations.length) {
                section.style.display = userProfile.rads >= 250 ? 'block' : 'none';
                list.innerHTML = '<p style="opacity:0.5;">NO ACTIVE MUTATIONS. ' + (userProfile.rads >= 250 ? 'KEEP IRRADIATING — THE WASTES ARE CHANGING YOU.' : 'REACH 250 RADS TO START MUTATING.') + '</p>';
                return;
            }
            section.style.display = 'block';
            let html = '';
            activeMutations.forEach(mid => {
                const m = MUTATIONS.find(x => x.id === mid);
                if (!m) return;
                html += '<div class="item-row" style="cursor:default;"><div class="item-info"><div style="color:#ff9a3c; text-shadow:0 0 5px #ff9a3c;">☢ ' + escapeHtml(m.name) + '</div><div class="item-effects">' + escapeHtml(m.desc) + '</div></div></div>';
            });
            if (starchedPlayerUnlocked) {
                html += '<p style="font-size:0.85rem; opacity:0.7; margin-top:8px; color:#ffb642;">🧬 STARCHED GENES ACTIVE — MUTATIONS LOCKED.</p>';
            }
            list.innerHTML = html;
        }

        // ==================== STARCHED GENES (v0.58) ====================
        // Global Overseer toggle: world/starchedUnlocked (Firebase boolean).
        // Player unlock: one-time, stored in pipboy-starched localStorage.
        // Effect: decon stations cannot strip mutations.
        let starchedGloballyUnlocked = false;
        let starchedPlayerUnlocked = localStorage.getItem('pipboy-starched') === 'true';
        function startStarchedListener() {
            if (!window.db) return;
            window.firebaseOnValue(window.firebaseRef(window.db, 'world/starchedUnlocked'), (snap) => {
                const wasGloballyEnabled = starchedGloballyUnlocked;
                starchedGloballyUnlocked = snap.val() === true;
                // v0.60: if Overseer disables globally, revoke player's unlock too
                if (wasGloballyEnabled && !starchedGloballyUnlocked && starchedPlayerUnlocked) {
                    starchedPlayerUnlocked = false;
                    localStorage.removeItem('pipboy-starched');
                }
                updateStarchedUI();
            }, () => {});
        }
        function updateStarchedUI() {
            const section = document.getElementById('starched-unlock-section');
            const btn = document.getElementById('starched-unlock-btn');
            const dna = document.getElementById('vb-starched');
            if (starchedGloballyUnlocked) {
                // Globally enabled — show toggle button
                if (section) section.style.display = 'block';
                if (btn) {
                    btn.innerText = starchedPlayerUnlocked ? '[🧬 STARCHED GENES: ON]' : '[🧬 STARCHED GENES: OFF]';
                    btn.onclick = toggleStarchedGenes;
                }
                if (dna) dna.style.display = starchedPlayerUnlocked ? '' : 'none';
            } else {
                // Not globally available — hide everything
                if (section) section.style.display = 'none';
                if (dna) dna.style.display = 'none';
            }
        }
        // v0.60: player can toggle Starched Genes on/off (was one-time unlock)
        function toggleStarchedGenes() {
            const newVal = !starchedPlayerUnlocked;
            showCustomPrompt((newVal ? 'ENABLE' : 'DISABLE') + ' STARCHED GENES? ' + (newVal ? 'YOUR MUTATIONS BECOME PERMANENT — DECON CANNOT STRIP THEM.' : 'YOUR MUTATIONS CAN BE STRIPPED BY DECON STATIONS AGAIN.'), [
                { label: newVal ? 'ENABLE' : 'DISABLE', color: '#ffb642', action: () => {
                    starchedPlayerUnlocked = newVal;
                    if (newVal) localStorage.setItem('pipboy-starched', 'true');
                    else localStorage.removeItem('pipboy-starched');
                    updateStarchedUI();
                    showNotification('🧬 STARCHED GENES ' + (newVal ? 'ENABLED' : 'DISABLED') + '.');
                }},
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }
        function toggleStarchedGlobal() {
            if (!window.db) { showNotification('NO SATELLITE LINK.'); return; }
            const newVal = !starchedGloballyUnlocked;
            showCustomPrompt((newVal ? 'ENABLE' : 'DISABLE') + ' STARCHED GENES GLOBALLY? ' + (newVal ? 'ALL PLAYERS WILL SEE THE UNLOCK BUTTON.' : 'THE UNLOCK BUTTON DISAPPEARS FOR EVERYONE.'), [
                { label: newVal ? 'ENABLE' : 'DISABLE', color: '#ffb642', action: () => {
                    window.firebaseSet(window.firebaseRef(window.db, 'world/starchedUnlocked'), newVal)
                        .then(() => showNotification('STARCHED GENES ' + (newVal ? 'ENABLED' : 'DISABLED') + ' GLOBALLY.'))
                        .catch(() => showNotification('FAILED — CHECK RULES.'));
                }},
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        // ONBOARDING LOGIC (v0.29: the G.O.A.T. exam is the SOLE S.P.E.C.I.A.L. allocator)
        const obSpecial = { S: 1, P: 1, E: 1, C: 1, I: 1, A: 1, L: 1 };
        const specialNames = { S: 'STRENGTH', P: 'PERCEPTION', E: 'ENDURANCE', C: 'CHARISMA', I: 'INTELLIGENCE', A: 'AGILITY', L: 'LUCK' };
        
        let obOriginId = null;
        const obOrigins = [
            { id: 'vault', name: 'VAULT-TEC DEFECTOR', desc: 'You woke up in a tunnel. Now you drive. [+1 INT. +1 PER. +20 Vault-Tec rep]', stats: { I: 1, P: 1 } },
            { id: 'warboy', name: 'WAR BOY RUNAWAY', desc: 'Half-life is not enough. You want it all. [+1 STR. +1 END. +20 War Boys rep]', stats: { S: 1, E: 1 } },
            { id: 'scavenger', name: 'WASTELAND DRIFTER', desc: 'You survive on scrap and wits. [+1 LCK. +1 CHA. +20 Scavengers rep]', stats: { L: 1, C: 1 } }
        ];

        let obTraitId = null;
        const obTraits = [
            { id: 'guzzoline', name: 'GUZZOLINE ADDICT', desc: 'You run on fumes and spite. Max HP reduced to 80. Radiation accumulates at half rate.' },
            { id: 'kamikaze', name: 'KAMIKAZE', desc: 'Massive melee damage. +2 Strength. -2 Endurance.' },
            { id: 'heavy', name: 'HEAVY HANDED', desc: 'You break things. +20 Melee Skill. +1 Strength. -2 Intelligence.' },
            { id: 'four_eyes', name: 'GOGGLE WEARER', desc: 'You need your goggles. +2 Perception. -1 Charisma.' },
            { id: 'small_frame', name: 'SMALL FRAME', desc: 'Hard to hit. +2 Agility. -1 Strength.' }
        ];

        const obExamQuestions = [
            {
                q: "You are approached by a frenzied <del style='opacity:0.5'>Vault Security Officer</del> <span style='color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;'>War Boy</span>. He demands your <del style='opacity:0.5'>Sweetroll</del> <span style='color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;'>Guzzoline</span>. Do you:",
                a: [
                    { text: "Shoot him in the face. (+2 STR, +2 AGI)", stats: ['S', 'A'] },
                    { text: "Give it to him, then steal it back. (+2 PER, +2 AGI)", stats: ['P', 'A'] },
                    { text: "Talk him into joining your crew. (+2 CHA, +2 LUK)", stats: ['C', 'L'] }
                ]
            },
            {
                q: "While exploring an abandoned <del style='opacity:0.5'>Super Duper Mart</del> <span style='color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;'>Scrap Fortress</span>, you find a locked <del style='opacity:0.5'>Safe</del> <span style='color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;'>V8 Engine Block</span>. Do you:",
                a: [
                    { text: "Smash it open with a rock. (+2 STR, +2 END)", stats: ['S', 'E'] },
                    { text: "Pick the lock with a rusty wire. (+2 PER, +2 INT)", stats: ['P', 'I'] },
                    { text: "Find someone else to open it for a cut. (+2 CHA, +2 INT)", stats: ['C', 'I'] }
                ]
            },
            {
                q: "The <del style='opacity:0.5'>Overseer</del> <span style='color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;'>Immortan</span> has summoned you for a <del style='opacity:0.5'>routine checkup</del> <span style='color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;'>bloodbag harvesting</span>. Do you:",
                a: [
                    { text: "Run into the wasteland. (+2 AGI, +2 END)", stats: ['A', 'E'] },
                    { text: "Rig the medical bay to explode. (+2 INT, +2 LUK)", stats: ['I', 'L'] },
                    { text: "Demand he witnesses you instead. (+2 CHA, +2 STR)", stats: ['C', 'S'] }
                ]
            },
            {
                q: "You find a <del style='opacity:0.5'>Radroach</del> <span style='color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;'>two-headed lizard</span> roasting on a spit. It belongs to a sleeping <del style='opacity:0.5'>Ghoul</del> <span style='color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;'>Buzzard Raider</span>. Do you:",
                a: [
                    { text: "Sneak up and steal the lizard. (+2 AGI, +2 PER)", stats: ['A', 'P'] },
                    { text: "Wake him up and challenge him for it. (+2 STR, +2 END)", stats: ['S', 'E'] },
                    { text: "Wait until he leaves and scavenge the bones. (+2 LUK, +2 INT)", stats: ['L', 'I'] }
                ]
            },
            {
                q: "A <del style='opacity:0.5'>Deathclaw</del> <span style='color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;'>War Rig</span> is charging directly at you. You have a single <del style='opacity:0.5'>Stimpak</del> <span style='color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;'>Thunderstick</span>. Do you:",
                a: [
                    { text: "Throw it at the engine and dive for cover. (+2 PER, +2 INT)", stats: ['P', 'I'] },
                    { text: "Stand your ground and scream. (+2 CHA, +2 END)", stats: ['C', 'E'] },
                    { text: "Close your eyes and throw it wildly. (+2 LUK, +2 STR)", stats: ['L', 'S'] }
                ]
            }
        ];

        let obExamStep = 0;

        const availablePerks = [
            { id: 'witness', name: 'WITNESS ME!', desc: 'Ride eternal, shiny and chrome. +10 to combat skills.' },
            { id: 'blackthumb', name: 'BLACKTHUMB MECHANIC', desc: 'You speak to the engines. Master of scrap and repairs.' },
            { id: 'bloodbag', name: 'UNIVERSAL BLOODBAG', desc: 'High octane blood. +10 to Pox Survival and Endurance limits.' },
            { id: 'ayatollah', name: 'WASTELAND LEGEND', desc: 'Your name echoes across the wastes. +20 starting reputation with ALL factions.' },
            { id: 'feral', name: 'FERAL BITER', desc: 'Words are hard. Biting is easy. Extra Unarmed damage.' }
        ];
        let selectedPerkId = 'witness';

        function initOnboarding() {
            if (userProfile.isInitiated) {
                // If user exists, skip straight to app (hide boot screen instantly)
                document.getElementById('boot-splash').style.display = 'none';
                document.getElementById('onboarding-overlay').style.display = 'none';
                document.getElementById('pre-boot-overlay').style.display = 'none';
                renderProfile();
                return;
            }

            // Show Calibration Screen first instead of jumping straight to Boot
            document.getElementById('pre-boot-overlay').style.display = 'flex';
        }

        function startBootSequence() {
            document.getElementById('pre-boot-overlay').style.display = 'none';
            runBootSequence();
        }

        // AUTHORIZE ALL DEVICE HARDWARE AT BOOT (v0.30)
        // Every native permission prompt (GPS / camera / notifications) can only fire ONCE
        // per origin. Burning them during calibration guarantees ZERO mid-game popups,
        // which are the #1 cause of fullscreen ejection + immersion breaks in the field.
        async function primeDevicePermissions() {
            const statusEl = document.getElementById('pb-perm-status');
            const btn = document.getElementById('pb-perm-btn');
            if (!statusEl) return;
            statusEl.style.display = 'block';
            statusEl.innerHTML = '';
            if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

            const logLine = (label, state, color) => {
                statusEl.innerHTML += `<div>&gt; ${label} ... [<span style="color:${color}; text-shadow: 0 0 5px ${color};">${state}</span>]</div>`;
            };
            const scanLine = (label) => {
                statusEl.innerHTML += `<div>&gt; ${label} ... [SCANNING]</div>`;
            };

            // 1. SATELLITE LINK (one-shot geolocation fix -- primes the permission)
            scanLine('SATELLITE LINK');
            await new Promise((resolve) => {
                if (!navigator.geolocation) { logLine('SATELLITE LINK', 'UNAVAILABLE', '#ffb642'); return resolve(); }
                navigator.geolocation.getCurrentPosition(
                    () => { logLine('SATELLITE LINK', 'OK', '#33ff33'); resolve(); },
                    () => { logLine('SATELLITE LINK', 'DENIED', '#ff3333'); resolve(); },
                    { timeout: 8000, maximumAge: 60000 }
                );
            });

            // 2. OPTICAL SENSOR (camera permission -- then IMMEDIATELY release the hardware)
            scanLine('OPTICAL SENSOR');
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    stream.getTracks().forEach(t => t.stop()); // permission primed, LED off, zero battery cost
                    logLine('OPTICAL SENSOR', 'OK', '#33ff33');
                } catch (e) {
                    logLine('OPTICAL SENSOR', 'DENIED', '#ff3333');
                }
            } else {
                logLine('OPTICAL SENSOR', 'UNAVAILABLE', '#ffb642');
            }

            // 3. RADIO TRANSMISSIONS (push notifications; guarded for devices without the API)
            if ('Notification' in window) {
                try {
                    const perm = await Notification.requestPermission();
                    logLine('RADIO TX', perm === 'granted' ? 'OK' : 'DENIED', perm === 'granted' ? '#33ff33' : '#ff3333');
                } catch (e) {
                    logLine('RADIO TX', 'UNAVAILABLE', '#ffb642');
                }
            } else {
                logLine('RADIO TX', 'UNAVAILABLE', '#ffb642');
            }

            // The popup chain may have ejected fullscreen on Android -- slide straight back in
            restoreFullscreenIfDesired();

            statusEl.innerHTML += `<div style="margin-top: 5px; opacity: 0.7;">&gt; AUTHORIZATION COMPLETE. DENIED ITEMS STAY SILENT (IN-APP ALERTS ONLY).</div>`;
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.innerText = '[3] RE-CHECK HARDWARE AUTH';
            }
        }

        function devSkipToApp() {
            userProfile.name = "DEV TESTER";
            userProfile.origin = obOrigins[0];
            userProfile.trait = obTraits[0];
            userProfile.perk = availablePerks[0];
            userProfile.isInitiated = true;
            
            // Give baseline stats so UI doesn't break
            userProfile.special = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };
            
            calculateSkills();
            saveToStorage();
            
            document.getElementById('pre-boot-overlay').style.display = 'none';
            document.getElementById('boot-splash').style.display = 'none';
            document.getElementById('onboarding-overlay').style.display = 'none';
            renderProfile();
        }

        function runBootSequence() {
            const logs = [
                { id: 'boot-log-1', delay: 500 },
                { id: 'boot-log-2', delay: 1000 },
                { id: 'boot-log-3', delay: 1500 },
                { id: 'boot-log-4', delay: 2500 },
                { id: 'boot-log-5', delay: 3000 },
                { id: 'boot-log-6', delay: 4200 }, // Error
                { id: 'boot-log-7', delay: 5500 }, // Locking
                { id: 'boot-log-8', delay: 7000 }, // Hacking...
                { id: 'boot-log-9', delay: 7800 },
                { id: 'boot-log-10', delay: 8600 },
                { id: 'boot-log-11', delay: 9400 },
                { id: 'boot-log-12', delay: 9800, action: runDecodeAnimation }, // Decoding Animation
                { id: 'boot-log-13', delay: 12500 }, // Access Granted
                { id: 'boot-log-14', delay: 13500 }, // Sideloading
                { id: 'boot-log-15', delay: 14500 }  // Please Stand By
            ];

            logs.forEach(log => {
                setTimeout(() => {
                    const el = document.getElementById(log.id);
                    if (el) {
                        el.style.display = 'block';
                    }
                    if(log.action) log.action();
                }, log.delay);
            });

            // After sequence finishes, hide boot screen and show VTARS form
            setTimeout(() => {
                document.getElementById('boot-splash').style.display = 'none';
                document.getElementById('onboarding-overlay').style.display = 'flex';
                renderObStep();
            }, 16500);
        }

        function runDecodeAnimation() {
            const el = document.getElementById('hack-decode-text');
            const target = "0x7F8E: OVERRIDE_LOCKDOWN_PROTOCOL";
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
            let iterations = 0;
            const maxIterations = 30;
            
            const interval = setInterval(() => {
                let currentStr = "";
                for(let i=0; i<target.length; i++) {
                    if (iterations > maxIterations/2 && Math.random() > 0.5) {
                        currentStr += target[i]; // Start locking in letters
                    } else {
                        currentStr += chars[Math.floor(Math.random() * chars.length)];
                    }
                }
                el.innerText = currentStr;
                iterations++;
                
                if(iterations >= maxIterations) {
                    clearInterval(interval);
                    el.innerText = target;
                }
            }, 75);
        }

        let obStep = 1;
        let obNameCache = ''; // preserves the typed name across onboarding re-renders (e.g. opt-in toggle)

        function renderObStep(preventScroll = false) {
            const container = document.getElementById('ob-dynamic-container');
            // Scroll to the top of the container every time a new step or question is rendered
            if (!preventScroll) {
                container.parentElement.scrollTop = 0;
            }
            
            let html = '';

            if (obStep === 1) {
                const isOptIn = localStorage.getItem('pipboy-opt-in') === 'true';
                html = `
                    <h2>WELCOME WASTELANDER</h2><br>
                    <p>Enter user designation:</p><br>
                    <div class="form-group">
                        <input type="text" id="ob-name" class="pip-input vk-target" readonly onclick="openVk('ob-name')" placeholder="ENTER NAME..." style="font-size: 1.5rem; text-align: center;" value="${obNameCache || (userProfile.name !== 'UNKNOWN' ? userProfile.name : '')}">
                    </div>
                    <div class="item-row" style="flex-direction: column; cursor: pointer; ${isOptIn ? 'border: 1px solid var(--pip-color); box-shadow: 0 0 8px var(--pip-color-dim);' : ''}" onclick="toggleOptIn()">
                        <div style="font-weight: bold; padding: 5px 0;">
                            <span style="color: var(--pip-color); text-shadow: 0 0 6px var(--pip-color);">${isOptIn ? '☑' : '□'}</span> OPT-IN: LIVE LOCATION TRACKING
                        </div>
                        <div style="font-size: 0.8rem; opacity: 0.8;">I understand that enabling my Pip-Boy GPS will permanently broadcast my Last Known Location to all other event attendees on the global map.</div>
                    </div>
                    <button class="pip-btn" onclick="obNext()">CONTINUE</button>
                `;
            } 
            else if (obStep === 2) {
                html = `
                    <h2>SELECT ORIGIN</h2><br>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${obOrigins.map(o => `
                            <div class="item-row" style="flex-direction: column; ${obOriginId === o.id ? 'background: var(--pip-color-dim); color: var(--pip-bg); text-shadow: none;' : ''}" onclick="selectObOrigin('${o.id}')">
                                <div style="font-weight: bold;">${obOriginId === o.id ? '■' : '□'} ${o.name}</div>
                                <div style="font-size: 0.9rem; opacity: 0.8; margin-top: 5px;">${o.desc}</div>
                            </div>
                        `).join('')}
                    </div>
                    <br>
                    <button class="pip-btn" onclick="obNext()">CONTINUE</button>
                `;
            }
            else if (obStep === 3) {
                html = `
                    <h2>THE G.O.A.T. EXAM</h2><br>
                    <p style="font-size: 1.1rem; line-height: 1.4; margin-bottom: 15px;">To accurately assess your combat capability and societal worth within the <del style="opacity:0.5;">Vault</del> <span style="color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;">Wasteland</span>, you must complete the <strong>G.O.A.T.</strong> Assessment.</p>
                    <ul style="list-style-type: square; padding-left: 20px; font-size: 1.1rem; margin-bottom: 25px; opacity: 0.9; line-height: 1.3;">
                        <li><span style="color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;">G</span>ENERALIZED</li>
                        <li><span style="color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;">O</span>CCUPATIONAL</li>
                        <li><span style="color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;">A</span>PTITUDE</li>
                        <li><span style="color:#ffb642; font-weight:bold; text-shadow:0 0 5px #ffb642;">T</span>EST</li>
                    </ul>
                    <p style="font-size: 1rem; opacity: 0.8; margin-bottom: 25px;">Your responses ALONE will define your final S.P.E.C.I.A.L. attributes (+2 to each listed attribute per answer). There is NO manual assignment afterwards.</p>
                    <button class="pip-btn" onclick="obNext()">BEGIN EXAM</button>
                `;
            }
            else if (obStep === 4) {
                const qData = obExamQuestions[obExamStep];
                html = `
                    <h2>G.O.A.T. EXAM (Q${obExamStep + 1}/5)</h2><br>
                    <p style="font-size: 1.2rem; line-height: 1.4; margin-bottom: 20px;">${qData.q}</p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${qData.a.map((ans, idx) => {
                            const isActive = tempExamAnswer === idx;
                            return `
                            <div class="item-row" style="flex-direction: column; ${isActive ? 'background: var(--pip-color-dim); color: var(--pip-bg); text-shadow: none;' : ''}" onclick="answerExam(${idx})">
                                <div style="font-weight: bold; padding: 5px 0;">${isActive ? '■' : '□'} ${ans.text}</div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                    <br>
                    <button class="pip-btn" onclick="confirmExamAnswer()">CONFIRM</button>
                `;
            }
            else if (obStep === 6) {
                html = `
                    <h2>SELECT DOUBLE-EDGED TRAIT</h2><br>
                    <p style="opacity: 0.8; font-size: 0.9rem; margin-bottom: 10px;">Traits offer powerful buffs, but come with a permanent penalty.</p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${obTraits.map(t => `
                            <div class="item-row" style="flex-direction: column; ${obTraitId === t.id ? 'background: var(--pip-color-dim); color: var(--pip-bg); text-shadow: none;' : ''}" onclick="selectObTrait('${t.id}')">
                                <div style="font-weight: bold;">${obTraitId === t.id ? '■' : '□'} ${t.name}</div>
                                <div style="font-size: 0.9rem; opacity: 0.8; margin-top: 5px;">${t.desc}</div>
                            </div>
                        `).join('')}
                    </div>
                    <br>
                    <button class="pip-btn" onclick="obNext()">CONTINUE</button>
                `;
            }
            else if (obStep === 7) {
                html = `
                    <h2>SELECT SURVIVOR PERK</h2><br>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${availablePerks.map(p => `
                            <div class="item-row" style="flex-direction: column; ${selectedPerkId === p.id ? 'background: var(--pip-color-dim); color: var(--pip-bg); text-shadow: none;' : ''}" onclick="selectObPerk('${p.id}')">
                                <div style="font-weight: bold;">${selectedPerkId === p.id ? '■' : '□'} ${p.name}</div>
                                <div style="font-size: 0.9rem; opacity: 0.8; margin-top: 5px;">${p.desc}</div>
                            </div>
                        `).join('')}
                    </div>
                    <br>
                    <button class="pip-btn" onclick="finishOnboarding()" style="font-weight: bold; border-style: dashed;">COMPLETE REGISTRATION</button>
                `;
            }

            container.innerHTML = html;
        }

        function selectObOrigin(id) { obOriginId = id; renderObStep(true); }
        function selectObTrait(id) { obTraitId = id; renderObStep(true); }
        function selectObPerk(id) { selectedPerkId = id; renderObStep(true); }

        let tempExamAnswer = null;

        function answerExam(ansIdx) {
            tempExamAnswer = ansIdx;
            renderObStep(true); // Re-render without scrolling to show selected state
        }

        function confirmExamAnswer() {
            if (tempExamAnswer === null) return showNotification("PLEASE SELECT AN ANSWER.");
            
            const qData = obExamQuestions[obExamStep];
            const ans = qData.a[tempExamAnswer];
            
            // The exam alone assigns ALL S.P.E.C.I.A.L. points: +2 to each listed attribute (cap 10)
            ans.stats.forEach(stat => {
                obSpecial[stat] = Math.min(10, obSpecial[stat] + 2);
            });

            obExamStep++;
            tempExamAnswer = null; // Reset for next question

            if (obExamStep >= obExamQuestions.length) {
                // No manual allocation screen -- the exam IS the allocation
                userProfile.special = {...obSpecial};
                obStep = 6; // Jump straight to trait selection
                renderObStep();
            } else {
                renderObStep(); // Scroll to top so they can read the next question
            }
        }

        function toggleOptIn() {
            // Preserve whatever name is currently typed before re-rendering wipes the input
            const nameEl = document.getElementById('ob-name');
            if (nameEl) obNameCache = nameEl.value;
            let current = localStorage.getItem('pipboy-opt-in') === 'true';
            localStorage.setItem('pipboy-opt-in', !current);
            renderObStep(true);
        }

        function obNext() {
            if (obStep === 1) {
                const name = document.getElementById('ob-name').value.trim();
                if (!name) return showNotification("IDENTITY CANNOT BE BLANK.");
                if (localStorage.getItem('pipboy-opt-in') !== 'true') return showNotification("YOU MUST AGREE TO THE SATELLITE TRACKING WAIVER TO PROCEED.");
                userProfile.name = name.toUpperCase();
                obNameCache = '';
                obStep = 2;
            } else if (obStep === 2) {
                if (!obOriginId) return showNotification("PLEASE SELECT AN ORIGIN.");
                obStep = 3;
            } else if (obStep === 3) {
                obStep = 4;
            } else if (obStep === 4) {
                // If they are on the exam questions, clicking "CONTINUE" does nothing 
                // because they have to answer the question to advance.
                return;
            } else if (obStep === 6) {
                if (!obTraitId) return showNotification("PLEASE SELECT A TRAIT.");
                obStep = 7;
            }
            renderObStep();
        }

        function finishOnboarding() {
            if (!selectedPerkId) return showNotification("PLEASE SELECT A SURVIVOR PERK.");

            // Store origin and trait
            const originData = obOrigins.find(o => o.id === obOriginId);
            const traitData = obTraits.find(t => t.id === obTraitId);
            const perkData = availablePerks.find(p => p.id === selectedPerkId);
            
            userProfile.origin = originData;
            userProfile.trait = traitData;
            userProfile.perk = perkData;
            userProfile.isInitiated = true;

            // v0.59: ORIGIN bonuses — stat modifiers applied in calculateSkills, faction rep here, no items (INV retired)
            if (obOriginId === 'vault') {
                const f = factions.find(fac => fac.name === "VAULT-TEC SURVIVORS");
                if (f) f.rep += 20;
            } else if (obOriginId === 'warboy') {
                const f1 = factions.find(fac => fac.name === "THE WAR BOYS");
                if (f1) f1.rep += 20;
            } else if (obOriginId === 'scavenger') {
                const f = factions.find(fac => fac.name === "SCAVENGERS GUILD");
                if (f) f.rep += 20;
            }

            // v0.59: TRAIT bonuses — Guzzoline Addict: HP reduced to 80 + half-rad mechanic (no items)
            if (obTraitId === 'guzzoline') {
                userProfile.maxHp = 80;
            }

            // v0.59: PERK bonuses — Wasteland Legend: +20 rep to ALL factions (no items)
            if (perkData.id === 'ayatollah') {
                factions.forEach(f => f.rep += 20);
            }

            calculateSkills();

            saveToStorage(); 
            
            document.getElementById('onboarding-overlay').style.display = 'none';
            renderProfile();
        }

        function calculateSkills() {
            // Apply Origin Stat Modifiers ONLY ONCE
            if (!userProfile.hasCalculatedBaseSpecial) {
                if (userProfile.origin) {
                    if (userProfile.origin.stats) {
                        for (let stat in userProfile.origin.stats) {
                            userProfile.special[stat] += userProfile.origin.stats[stat];
                        }
                    }
                }

                // Apply Trait Stat Modifiers
                if (userProfile.trait) {
                    if (userProfile.trait.id === 'kamikaze') {
                        userProfile.special.S += 2;
                        userProfile.special.E -= 2;
                    } else if (userProfile.trait.id === 'heavy') {
                        userProfile.special.S += 1;
                        userProfile.special.I -= 2;
                    } else if (userProfile.trait.id === 'four_eyes') {
                        userProfile.special.P += 2;
                        userProfile.special.C -= 1;
                    } else if (userProfile.trait.id === 'small_frame') {
                        userProfile.special.A += 2;
                        userProfile.special.S -= 1;
                    }
                }

                // Cap all stats between 1 and 10 after modifiers
                for (let key in userProfile.special) {
                    if (userProfile.special[key] < 1) userProfile.special[key] = 1;
                    if (userProfile.special[key] > 10) userProfile.special[key] = 10;
                }
                
                userProfile.hasCalculatedBaseSpecial = true;
            }

            const sp = userProfile.special;
            const lck = sp.L;
            
            // Apply Heavy Handed extra logic to skills
            const meleeBonus = userProfile.trait && userProfile.trait.id === 'heavy' ? 20 : 0;
            
            // Base logic: 5 + (Stat * 2) + Luck
            userProfile.skills = [
                { name: "GUZZOLINE BARTER", val: 5 + (sp.C * 2) + lck },
                { name: "BOOM-BOY EXPLOSIVES", val: 5 + (sp.P * 2) + lck },
                { name: "BLOODBAG MEDICINE", val: 5 + (sp.I * 2) + lck },
                { name: "THUNDERSTICK MELEE", val: 5 + (sp.S * 2) + lck + meleeBonus },
                { name: "BLACKTHUMB REPAIR", val: 5 + (sp.I * 2) + lck },
                { name: "OLD WORLD LORE", val: 5 + (sp.I * 2) + lck },
                { name: "LEAD SLINGERS", val: 5 + (sp.A * 2) + lck },
                { name: "WASTELAND GHOST", val: 5 + (sp.A * 2) + lck },
                { name: "CULT DEMAGOGUE", val: 5 + (sp.C * 2) + lck },
                { name: "BARE-KNUCKLE BRAWL", val: 5 + (sp.E * 2) + lck + meleeBonus },
                { name: "POX SURVIVAL", val: 5 + (sp.E * 2) + lck },
                { name: "RIG & RIDE (PILOT)", val: 5 + (sp.A * 2) + lck }
            ];

            // Assign Title based on highest stat
            const highestStat = Object.keys(sp).reduce((a, b) => sp[a] > sp[b] ? a : b);
            const titles = { S: "BRUISER", P: "SCOUT", E: "BLOODBAG", C: "WARLORD", I: "BLACKTHUMB", A: "NIGHTRIDER", L: "SCAVENGER" };
            userProfile.title = titles[highestStat] + " OF THE ECLIPSE";
        }

        function renderProfile() {
            if (!userProfile.skills) calculateSkills(); // fallback if missing
            
            document.getElementById('stat-name-display').innerText = 'NAME: ' + userProfile.name;
            
            // Update Title
            const titleEl = document.querySelector('#sub-stat-status p:nth-of-type(2)');
            if(titleEl) titleEl.innerText = `LVL 1 - ${userProfile.title}`;
            
            // Render Math for HP vs Rads
            const radsRaw = userProfile.rads || 0;
            // Rads scale from 0 to 1000. So we convert it to a percentage of HP it eats.
            const radPercent = (radsRaw / 1000) * 100;
            // If rads eat into HP, current HP is lowered
            const currentHp = Math.max(0, userProfile.maxHp - Math.floor((radsRaw / 1000) * userProfile.maxHp));
            
            // Update Text Readouts
            const hpVal = document.getElementById('status-hp-val');
            if (hpVal) hpVal.innerHTML = `${currentHp} HP | <span style="color: #ff3333;">${radsRaw} RADS</span>`;
            
            const footerHp = document.getElementById('footer-hp-display');
            if (footerHp) footerHp.innerText = `[HP ${currentHp}/${userProfile.maxHp}]`;
            
            const footerRads = document.getElementById('footer-rads-display');
            if (footerRads) footerRads.innerText = `[RADS ${radsRaw}]`;

            // Update Graphical Fill Bars
            const hpFill = document.getElementById('status-hp-fill-bar');
            if (hpFill) hpFill.style.width = `${(currentHp / userProfile.maxHp) * 100}%`;
            
            const radsFill = document.getElementById('status-rads-fill-bar');
            if (radsFill) radsFill.style.width = `${radPercent}%`;

            // v0.52: the FOOTER bar (bottom-left HUD) was never wired -- its fills sat at
            // 100%/0% since the dawn of the wasteland. Red now overtakes green there too.
            const footHpFill = document.getElementById('hp-fill-bar');
            if (footHpFill) footHpFill.style.width = `${(currentHp / userProfile.maxHp) * 100}%`;
            const footRadsFill = document.getElementById('rads-fill-bar');
            if (footRadsFill) footRadsFill.style.width = `${radPercent}%`;
            
            let spHTML = '';
            for (let key in userProfile.special) {
                spHTML += `<p><span>${specialNames[key]}</span> <span>${userProfile.special[key]}</span></p>`;
            }
            document.getElementById('special-list-display').innerHTML = spHTML;

            // Render Themed Skills
            let skHTML = '';
            userProfile.skills.forEach(sk => {
                skHTML += `<p><span>${sk.name}:</span> <span>${sk.val}</span></p>`;
            });
            document.getElementById('skills-list-display').innerHTML = skHTML;

            renderVaultBoy(); // v0.50: STATUS graphic (databank pick) + overlays ride profile repaints
            renderMutations(); // v0.58: active mutations list + starched indicator
            updateStarchedUI(); // v0.58: starched genes button/DNA strand visibility

            let pkHTML = '';
            if (userProfile.perk) {
                pkHTML += `
                <div class="item-row">
                    <div class="item-info">
                        <div>${userProfile.perk.name}</div>
                        <div class="item-effects">${userProfile.perk.desc}</div>
                    </div>
                </div>`;
            }
            document.getElementById('perks-list-display').innerHTML = pkHTML;
        }

        // 2. NOW setup the clock which depends on quests
        let glitchThreshold = Math.floor(Math.random() * 5) + 5; // Glitch every 5 to 10 seconds
        let glitchTimer = 0;

        function updateClock() {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = String(now.getFullYear() - 2000 + 3000).slice(-2); // 2026 → 3026
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            document.getElementById('pip-clock').innerText = `${day}/${month}/${year} ${hours}:${minutes}`;
            
            // Easter Egg: OS Name Glitch
            glitchTimer++;
            if (glitchTimer >= glitchThreshold) { 
                const titleEl = document.getElementById('main-os-title');
                
                // Show the glitch
                titleEl.innerText = "PIP-BOY 3000";
                titleEl.style.color = "#ff3333";
                titleEl.style.textShadow = "0 0 10px #ff3333";
                
                // Randomize how long the glitch holds (from 0.1s up to 1 second)
                const holdDuration = 100 + Math.random() * 900;

                setTimeout(() => {
                    titleEl.innerText = "POX-BOY 3026";
                    titleEl.style.color = "var(--pip-color)";
                    titleEl.style.textShadow = "none";
                }, holdDuration);
                
                // Reset timer and randomize the NEXT threshold
                glitchTimer = 0;
                glitchThreshold = Math.floor(Math.random() * 5) + 5; 
            }

            checkQuestTimers(now);
            if (document.getElementById('tab-data').classList.contains('active')) {
                updateQuestCountdowns(now);
            }
        }
        setInterval(updateClock, 1000);
        updateClock();

        // UI & Setup
        function switchMainTab(tabId) {
            // Derive the active tab from the DOM (works for clicks AND programmatic calls)
            document.querySelectorAll('.nav-tabs .nav-item').forEach(el => {
                const oc = el.getAttribute('onclick') || '';
                el.classList.toggle('active', oc.includes("'" + tabId + "'"));
            });
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');

            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';

            // Button Visibility Logic (v0.53: INV retired; dev console lives under STAT > STATS)
            const aib = document.getElementById('add-item-btn'); if (aib) aib.style.display = 'none';
            document.getElementById('add-quest-btn').style.display = (tabId === 'data' && currentDataTab === 'quests' && isDev) ? 'inline-block' : 'none';
            document.getElementById('faction-controls').style.display = (tabId === 'data' && currentDataTab === 'factions' && isDev) ? 'flex' : 'none';
            document.getElementById('dev-controls').style.display = (tabId === 'stat' && currentStatTab === 'stats') ? 'flex' : 'none';
            
            // v0.58: footer map marker buttons removed (use long-press map or split-controls sidebar)

            if (tabId === 'stat' && currentStatTab === 'stats') renderStatsTab(); // v0.53
            if (tabId === 'stat' && currentStatTab === 'overseer') renderOverseerTab(); // v0.58
            if (tabId === 'mail') { renderMail(); refreshOutboxStatuses(); }      // v0.53: top-level MAIL tab
            if (tabId === 'radio') renderRadioTab();                              // v0.54: overseer desk + LIVE badges on entry
            if (tabId === 'data') {
                if (currentDataTab === 'quests') renderQuests();
                if (currentDataTab === 'factions') renderFactions();
                if (currentDataTab === 'wastelanders') { renderWastelanders(); renderLinkRequests(); }
                if (currentDataTab === 'contracts') renderContracts(); // v0.55: ISSUE QUEST button must re-gate with dev mode
            }
            if (tabId === 'map') {
                // Leaflet needs to calculate size AFTER display block is applied
                setTimeout(initPipMap, 50); 
            }
            if (tabId === 'cam') {
                renderPhotoGallery();
            }
            if (tabId !== 'cam') {
                // Turn off the camera if they navigate away to save battery
                stopCamera();
            }
        }

        function switchSubTab(parentTab, subTabId) {
            const subNav = document.getElementById(`${parentTab}-sub-nav`);
            subNav.querySelectorAll('.sub-nav-item').forEach(el => {
                const oc = el.getAttribute('onclick') || '';
                el.classList.toggle('active', oc.includes("'" + subTabId + "'"));
            });
            
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            
            if (parentTab === 'inv') {
                currentInvTab = subTabId; // v0.53: INV tab retired; branch kept inert for stale callers
                renderInventory(subTabId);
            } else if (parentTab === 'stat') {
                // v0.70: STAT sub-tabs are now STATUS / SPECIAL / STATS / FACTIONS / OVERSEER / OPTIONS
                currentStatTab = subTabId;
                document.getElementById('dev-controls').style.display = (subTabId === 'stats') ? 'flex' : 'none';
                document.getElementById('faction-controls').style.display = (subTabId === 'factions' && isDev) ? 'flex' : 'none';
                document.getElementById(`tab-${parentTab}`).querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
                const target = document.getElementById(`sub-${parentTab}-${subTabId}`);
                if (target) target.classList.add('active');
                if (subTabId === 'stats') renderStatsTab();
                if (subTabId === 'factions') renderFactions();
                if (subTabId === 'overseer') renderOverseerTab();
            } else if (parentTab === 'data') {
                // v0.70: DATA sub-tabs are now QUESTS / CONTRACTS / WASTELANDERS (FACTIONS moved to STAT)
                currentDataTab = subTabId;
                document.getElementById('add-quest-btn').style.display = (subTabId === 'quests' && isDev) ? 'inline-block' : 'none';
                const devBtns = document.getElementById('dev-controls'); if (devBtns && subTabId !== '_mail') devBtns.style.display = (currentStatTab === 'stats' && document.getElementById('tab-stat').classList.contains('active')) ? 'flex' : 'none';

                document.getElementById(`tab-${parentTab}`).querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
                const dataTarget = document.getElementById(`sub-${parentTab}-${subTabId}`);
                if (dataTarget) dataTarget.classList.add('active');
                if (subTabId === 'quests') renderQuests();
                if (subTabId === 'contracts') renderContracts();
                if (subTabId === 'wastelanders') { renderWastelanders(); renderLinkRequests(); }
            } else {
                document.getElementById(`tab-${parentTab}`).querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
                document.getElementById(`sub-${parentTab}-${subTabId}`).classList.add('active');
            }
        }

        function cycleTheme() {
            // v0.69: skip PDA theme unless dev mode is active
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            let nextIndex = (currentThemeIndex + 1) % themes.length;
            // Skip PDA theme if not in dev mode
            if (!isDev && themes[nextIndex].pda) {
                nextIndex = (nextIndex + 1) % themes.length;
            }
            currentThemeIndex = nextIndex;
            const t = themes[currentThemeIndex];
            const root = document.documentElement;
            root.style.setProperty('--pip-color', t.hex);
            root.style.setProperty('--pip-color-dim', t.dim);
            root.style.setProperty('--crt-flicker', `rgba(${t.rgb}, 0.05)`);
            root.style.setProperty('--pip-rgb', t.rgb);
            // Theme-tinted hardware outputs: map tiles + camera sensor + QR scanner feed
            root.style.setProperty('--tile-filter', t.mapFx);
            // v0.69: toggle PDA theme class on body
            document.body.classList.toggle('pda-theme', !!t.pda);
            applyCamFilter(); // v0.35: routed so NIGHT MODE gain survives theme swaps
            // v0.33: header theme button moved to DATA > OPTIONS; label targets may be absent
            const themeLblLegacy = document.getElementById('theme-display');
            if (themeLblLegacy) themeLblLegacy.innerText = `[${t.name}]`;
            const optThemeBtn = document.getElementById('options-theme-btn');
            if (optThemeBtn) optThemeBtn.innerText = `[THEME: ${t.name}]`;
        }

        // ================= FULLSCREEN ENGINE (v0.23) =================
        // v0.21 trusted a window-size guess -> always "fullscreen" inside an installed PWA.
        // v0.22 trusted document.fullscreenElement alone -> but GPS/camera permission popups
        // can WEDGE the API: the browser exits fullscreen visually yet fullscreenElement stays
        // non-null, and exitFullscreen() then returns a promise that forever pends. The button
        // showed [EXIT FULL] and tapping it awaited a no-op = "selecting it does nothing".
        //
        // v0.23 RULES:
        //  1. TRUTH = Fullscreen API signal AND window-size signal, fused. If the API claims
        //     fullscreen but the browser chrome is visibly back (innerHeight shrank), the API
        //     is lying and we treat state as NOT fullscreen.
        //  2. NEVER naked-await exitFullscreen()/requestFullscreen() -- wedge states make
        //     those promises hang. Race every call against a timeout.
        //  3. If API says fullscreen but screen says no (the wedge), UNSTICK by firing
        //     exit (to clear the phantom lock) then re-requesting, all inside the user's tap.

        let fsIntent = false; // true while fullscreen is WANTED (autopilot enforces it)
        let fsBusy = false;   // serializes taps so a wedged call can't queue junk

        // Where is the app running?
        // 'fullscreen' = installed WebAPK with OS-level immersion (OS hides status bar and
        //                RE-APPLIES it automatically after system dialogs -- popups harmless)
        // 'standalone' = installed, status bar visible (DOM fullscreen hides it = visible delta)
        // 'browser'    = normal tab
        function getDisplayMode() {
            try {
                if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen';
                if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
            } catch (e) {}
            if (window.navigator.standalone === true) return 'standalone'; // iOS home-screen web app
            return 'browser';
        }

        function getFsElement() {
            return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
        }

        function getFsRequestFn() {
            const docEl = document.documentElement;
            return docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen || null;
        }

        function getFsExitFn() {
            return document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen || null;
        }

        function isFsApiSupported() {
            return !!getFsRequestFn();
        }

        // Visual signal: when browser UI bars reappear, innerHeight drops well below screen height.
        function isBrowserChromeVisible() {
            try { return window.innerHeight < screen.height * 0.9; } catch (e) { return false; }
        }

        // FUSED truth: only "fullscreen" when the API says so AND no browser chrome is visible.
        // In an installed PWA the chrome is hidden 24/7, so the API signal correctly dominates there.
        function isActuallyFullscreen() {
            return !!getFsElement() && !isBrowserChromeVisible();
        }

        function updateFsButtons() {
            const isFullscreen = isActuallyFullscreen();
            const fsBtn = document.getElementById('fs-btn');
            const pbFsBtn = document.getElementById('pb-fs-btn');
            const optFsBtn = document.getElementById('options-fs-btn'); // v0.33: new home for the control
            const mode = getDisplayMode();
            const supported = isFsApiSupported();

            // HIDE the control when it is meaningless:
            // - 'fullscreen' install: OS owns immersion 24/7 (enter/exit would be invisible no-ops)
            // - unsupported API while already installed (iOS home screen): nothing actionable to offer
            if (mode === 'fullscreen' || (!supported && mode === 'standalone')) {
                if (fsBtn) fsBtn.style.display = 'none';
                if (pbFsBtn) pbFsBtn.style.display = 'none';
                if (optFsBtn) optFsBtn.style.display = 'none';
                return;
            }
            if (fsBtn) fsBtn.style.display = '';
            if (pbFsBtn) pbFsBtn.style.display = '';
            if (optFsBtn) optFsBtn.style.display = '';

            if (isFullscreen) {
                if (fsBtn) fsBtn.innerText = '[EXIT FULL]';
                if (pbFsBtn) pbFsBtn.innerText = '[1] DISABLE FULLSCREEN';
                if (optFsBtn) optFsBtn.innerText = '[EXIT FULL]';
            } else if (fsIntent && isFsApiSupported()) {
                // User wanted fullscreen but it was lost (e.g. GPS permission popup).
                if (fsBtn) fsBtn.innerText = '[RESUME FULL]';
                if (pbFsBtn) pbFsBtn.innerText = '[1] RESUME FULLSCREEN';
                if (optFsBtn) optFsBtn.innerText = '[RESUME FULL]';
            } else {
                if (fsBtn) fsBtn.innerText = '[FULLSCREEN]';
                if (pbFsBtn) pbFsBtn.innerText = '[1] ENABLE FULLSCREEN';
                if (optFsBtn) optFsBtn.innerText = '[FULLSCREEN]';
            }
        }

        function fsRacePromise(promise, ms) {
            // Never let a wedged Fullscreen API promise stall the UI thread logic.
            return Promise.race([
                Promise.resolve(promise).catch(function(){}),
                new Promise(function(resolve) { setTimeout(resolve, ms); })
            ]);
        }

        function fsDelay(ms) {
            return new Promise(function(resolve) { setTimeout(resolve, ms); });
        }

        async function enterFullscreen(silent) {
            const reqFn = getFsRequestFn();
            if (!reqFn) {
                // iPhone Safari has no Fullscreen API for web pages at all.
                fsIntent = false;
                if (!silent) {
                    showNotification("NO FULLSCREEN API ON THIS BROWSER. FOR IMMERSIVE MODE: BROWSER MENU > ADD TO HOME SCREEN > LAUNCH THE POX-BOY ICON.");
                }
                updateFsButtons();
                return false;
            }

            // UNSTICK: API claims fullscreen but screen disagrees (permission-popup wedge).
            // Fire the exit to clear the phantom lock -- raced, because in the wedge it can
            // hang -- then pause one beat (well inside the 5s user-activation window) and
            // re-request cleanly below.
            if (getFsElement()) {
                const exitFn = getFsExitFn();
                if (exitFn) {
                    try { fsRacePromise(exitFn.call(document), 150); } catch (e) {}
                    await fsDelay(120);
                }
            }

            try {
                // v0.33: orientation lock REMOVED -- the majority of attendees run portrait,
                // and the split-layouts engage automatically on rotation via CSS media queries.
                await fsRacePromise(reqFn.call(document.documentElement, { navigationUI: 'hide' }), 800);
                if (getFsElement()) fsIntent = true;
                updateFsButtons();
                return !!getFsElement();
            } catch (err) {
                console.warn("Fullscreen request rejected:", err);
                updateFsButtons();
                return false;
            }
        }

        async function exitFullscreen() {
            fsIntent = false;
            // Try EVERY vendor exit variant in turn -- some WebViews expose mismatched
            // request/exit pairs, and a wedged exit promise hangs (so all are raced).
            const exits = [
                document.exitFullscreen,
                document.webkitExitFullscreen,
                document.webkitCancelFullScreen,
                document.mozCancelFullScreen,
                document.msExitFullscreen
            ];
            for (let i = 0; i < exits.length; i++) {
                if (!getFsElement()) break; // exit already took effect
                if (typeof exits[i] !== 'function') continue;
                try { await fsRacePromise(exits[i].call(document), 250); } catch (e) {}
            }
            updateFsButtons();
        }

        async function toggleFullscreen() {
            if (fsBusy) return; // ignore double-taps while a wedged call is being raced
            fsBusy = true;
            try {
                if (isActuallyFullscreen()) {
                    await exitFullscreen();
                } else {
                    fsIntent = true; // record intent FIRST so [RESUME FULL] works even if rejected
                    await enterFullscreen(false);
                }
            } finally {
                fsBusy = false;
                updateFsButtons();
            }
        }

        // Called after ANY native popup flow that can force-exit fullscreen
        // (GPS permission, camera permission, QR scanner permission). Usually lacks user
        // activation so the attempt is silently rejected -- the AUTOPILOT tap-listener below
        // is the guaranteed re-entry: the very next human touch anywhere restores fullscreen.
        function restoreFullscreenIfDesired() {
            fsAutoPilot();
            updateFsButtons();
        }

        // Instant sync: Fullscreen API events cover clean exits; RESIZE covers wedge exits
        // where the browser chrome reappears WITHOUT firing fullscreenchange (this is the
        // GPS-popup case). VISIBILITYCHANGE covers app-switch races.
        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function(evt) {
            document.addEventListener(evt, updateFsButtons);
        });
        document.addEventListener('fullscreenerror', updateFsButtons);
        document.addEventListener('webkitfullscreenerror', updateFsButtons);
        window.addEventListener('resize', updateFsButtons);
        document.addEventListener('visibilitychange', updateFsButtons);

        // ---- AUTOPILOT (v0.25, CALM-DOWN v0.42) ----
        // v0.42 (user-reported): the repeated "swipe down to exit fullscreen" hint and the
        // actual/almost-fullscreen jumping were both children of an OVER-EAGER autopilot --
        // it re-entered DOM fullscreen on EVERY tap (1.5s throttle) and after every popup
        // wedge, and each re-entry re-toasts Android's immersive hint. New policy:
        //   A) OS-immersive installs (display-mode: fullscreen) get NO DOM fullscreen at
        //      all -- the OS is already hiding the bars; DOM fullscreen on top was pure
        //      toast spam. fsIntent no longer arms in that mode and the pilot stands down.
        //   B) Re-entry is LOSS-DRIVEN (fullscreenchange events + app-switch return +
        //      resize), never every-tap, with a 5s cooldown. Recovery still happens after
        //      GPS/camera popup wedges -- just within a breath instead of instantly.
        fsIntent = (getDisplayMode() === 'standalone');

        let fsLastAutoAttempt = 0;
        let fsAutoInFlight = false;
        function fsAutoPilot() {
            if (getDisplayMode() === 'fullscreen') return; // A: OS already immersive -- nothing to do
            if (!fsIntent || fsBusy || fsAutoInFlight || !isFsApiSupported()) return;
            if (isActuallyFullscreen()) return; // fused truth also catches the wedge lie
            const now = Date.now();
            if (now - fsLastAutoAttempt < 5000) return; // B: calm cooldown (was 1.5s)
            fsLastAutoAttempt = now;
            fsAutoInFlight = true;
            // enterFullscreen() carries the wedge-UNSTICK path (phantom exit + re-request),
            // which the old raw-request pilot never had
            enterFullscreen(false).finally(function(){ fsAutoInFlight = false; });
        }

        // B: re-entry triggers are genuine LOSS events -- not every human touch. (The old
        // pointerdown/touchend capture listeners are deleted: they were the toast engine.)
        ['fullscreenchange', 'webkitfullscreenchange'].forEach(function(evt) {
            document.addEventListener(evt, fsAutoPilot);
        });
        window.addEventListener('resize', fsAutoPilot); // covers popup-wedge visual exits
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) { fsAutoPilot(); updateFsButtons(); }
        });
        // React if the display-mode itself changes (install state / window mode)
        try {
            window.matchMedia('(display-mode: fullscreen)').addEventListener('change', updateFsButtons);
            window.matchMedia('(display-mode: standalone)').addEventListener('change', updateFsButtons);
        } catch (e) {}

        // Poll as a final safety net for exotic WebViews that miss every event.
        setInterval(updateFsButtons, 500);
        updateFsButtons();

        const paddingModes = [0, 15, 30]; 
        const sizeLabels = ["MAX", "SHRINK 1", "SHRINK 2"];
        // v0.32: padding choice now persists across launches. Installed PWAs default to
        // MAX (edge-to-edge immersion); browser tabs keep the SHRINK 2 default.
        const savedSizeIndex = parseInt(localStorage.getItem('pipboy-size-index'), 10);
        let sizeIndex = (savedSizeIndex >= 0 && savedSizeIndex <= 2) ? savedSizeIndex : (getDisplayMode() !== 'browser' ? 0 : 2);
        
        function cycleSize() {
            sizeIndex = (sizeIndex + 1) % paddingModes.length;
            const label = sizeLabels[sizeIndex];
            document.body.style.padding = `${paddingModes[sizeIndex]}px`;
            localStorage.setItem('pipboy-size-index', sizeIndex);
            
            const mainBtn = document.getElementById('size-display');
            if (mainBtn) mainBtn.innerText = `[SIZE: ${label}]`;
            const pbBtn = document.getElementById('pb-size-btn');
            if (pbBtn) pbBtn.innerText = `[2] SCREEN PADDING: ${label}`;
            const optSizeBtn = document.getElementById('options-size-btn');
            if (optSizeBtn) optSizeBtn.innerText = `[SIZE: ${label}]`;
        }
        
        // Apply loaded/default size immediately + sync both button labels to it
        document.body.style.padding = `${paddingModes[sizeIndex]}px`;
        const bootMainBtn = document.getElementById('size-display');
        if (bootMainBtn) bootMainBtn.innerText = `[SIZE: ${sizeLabels[sizeIndex]}]`;
        const bootPbBtn = document.getElementById('pb-size-btn');
        if (bootPbBtn) bootPbBtn.innerText = `[2] SCREEN PADDING: ${sizeLabels[sizeIndex]}`;
        const bootOptSizeBtn = document.getElementById('options-size-btn');
        if (bootOptSizeBtn) bootOptSizeBtn.innerText = `[SIZE: ${sizeLabels[sizeIndex]}]`;

        // ================= PORTRAIT LOCK (v0.40) =================
        // v0.36-0.39 offered AUTO / PORTRAIT / LANDSCAPE as a user cycle in OPTIONS.
        // Per user direction: PORTRAIT IS THE ONLY MODE. The options button is retired,
        // the manifest is hard portrait, and this engine forces the lock whenever
        // immersion allows. The v0.38 anti-flap logic is KEPT: leaving immersion re-arms
        // and re-entry locks exactly ONCE -- never on every fullscreenchange. The dormant
        // landscape media queries stay in styles.css (inert under the lock; desktop
        // preview windows still get them) -- full exorcism is a post-event cleanup.
        // iOS has no lock() API: guard no-ops; the manifest portrait hint still applies.
        let portraitLockApplied = false;

        function applyPortraitLock() {
            if (!(screen.orientation && typeof screen.orientation.lock === 'function')) return;
            const immersed = (typeof getFsElement === 'function' && getFsElement()) || getDisplayMode() !== 'browser';
            if (!immersed) { portraitLockApplied = false; return; } // OS released the lock; re-arm for re-entry
            if (portraitLockApplied) return; // already vertical -- never re-snap the screen
            try {
                const p = screen.orientation.lock('portrait');
                if (p && p.then) {
                    p.then(function(){ portraitLockApplied = true; }, function(){ /* rejected outside immersion: stays armed, fullscreenchange retries */ });
                } else {
                    portraitLockApplied = true;
                }
            } catch (e) {}
        }

        ['fullscreenchange', 'webkitfullscreenchange'].forEach(function(evt) {
            document.addEventListener(evt, applyPortraitLock);
        });

        applyPortraitLock(); // boot: engage the lock immediately if already immersed

        // ================= PORTRAIT SHIELD (v0.41) =================
        // The OS does not always obey the v0.40 lock: browser tabs without fullscreen
        // rotate freely, Android auto-rotate and the nav-bar "rotate app" button both
        // override a mere lock() request, and a stale WebAPK ignores the new manifest
        // until Chrome re-mints it. So we stop negotiating: whenever the device REPORTS
        // a rotated angle (90/270), html.plock-* CSS counter-rotates the entire app so
        // it still READS portrait. Desktop angle never leaves 0, so wide preview
        // windows are untouched. The lock stays PRIMARY (when it wins, angle is 0 and
        // the shield never engages) -- this is the guaranteed backstop.
        function portraitShieldCheck() {
            let a = null;
            if (screen.orientation && typeof screen.orientation.angle === 'number') {
                a = screen.orientation.angle;
            } else if (typeof window.orientation === 'number') { // legacy iOS fallback
                a = window.orientation;
            } else {
                return;
            }
            a = ((a % 360) + 360) % 360;
            document.documentElement.classList.toggle('plock-90', a === 90);
            document.documentElement.classList.toggle('plock-270', a === 270);
        }
        if (screen.orientation && screen.orientation.addEventListener) {
            screen.orientation.addEventListener('change', portraitShieldCheck);
        }
        window.addEventListener('orientationchange', portraitShieldCheck); // older engines
        window.addEventListener('resize', portraitShieldCheck); // final safety net
        portraitShieldCheck();

        // Inventory Logic
        function renderInventory(category) {
            if (!document.getElementById('inv-container')) return; // v0.53: INV tab retired -- function inert
            const container = document.getElementById('inv-container');
            container.innerHTML = '';
            const filtered = items.filter(i => i.type === category);
            if (filtered.length === 0) return container.innerHTML = '<p style="text-align:center; opacity:0.5;">NO ITEMS</p>';
            filtered.forEach(item => {
                const el = document.createElement('div'); el.className = 'item-row'; el.onclick = () => openActionModal(item.id);
                el.innerHTML = `<div class="item-info"><div><span style="white-space: pre;">${item.equipped ? '■ ' : '  '}</span>${item.name}</div>
                <div class="item-effects">${item.effects}</div></div><div class="item-qty">${item.quantity > 1 ? 'x'+item.quantity : ''}</div>`;
                container.appendChild(el);
            });
        }

        // Quests & Timers Logic
        function checkQuestTimers(now) {
            let changed = false;
            quests.forEach(q => {
                if (!q.completed && !q.expired && q.expireTime) {
                    if (now.getTime() >= q.expireTime) {
                        q.expired = true;
                        changed = true;
                        showNotification("QUEST EXPIRED: " + q.name);
                    }
                }
            });
            if (changed) {
                saveToStorage();
                if(document.getElementById('tab-data').classList.contains('active')) renderQuests();
            }
        }

        function updateQuestCountdowns(now) {
            quests.forEach(q => {
                if(!q.completed && !q.expired && q.expireTime) {
                    const el = document.getElementById(`timer-${q.id}`);
                    if(el) {
                        const diff = q.expireTime - now.getTime();
                        if(diff > 0) {
                            const hh = Math.floor(diff / (1000 * 60 * 60));
                            const mm = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                            const ss = Math.floor((diff % (1000 * 60)) / 1000);
                            el.innerText = `[T-${hh.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}]`;
                        }
                    }
                }
            });
        }

        function showNotification(msg) {
            // In-app modal (always works). v0.48 DECOUPLING: showNotification is now
            // STRICTLY in-app — before this, every UI toast ("OVERSEER MODE ENABLED",
            // "TRANSMISSION SENT"...) was ALSO an OS push + vibration, nonstop spam.
            // OS pushes now flow ONLY via mailPingOs() (transmission categories + master).
            document.getElementById('notification-text').innerText = msg;
            document.getElementById('notification-modal').style.display = 'flex';

            // Haptic vibration (v0.48: OPTIONS-gated — the buzz was part of the pain)
            if (navigator.vibrate && localStorage.getItem('pipboy-vibrate') !== '0') navigator.vibrate([200, 100, 200]);
        }

        // v0.48: haptics master switch (default ON)
        function cycleVibrate() {
            const on = localStorage.getItem('pipboy-vibrate') === '0';
            localStorage.setItem('pipboy-vibrate', on ? '1' : '0');
            const b = document.getElementById('options-vibrate-btn');
            if (b) b.innerText = '[VIBRATE: ' + (on ? 'ON' : 'OFF') + ']';
            showNotification('VIBRATE ' + (on ? 'ON.' : 'OFF.'));
        }
        (function() {
            const b = document.getElementById('options-vibrate-btn');
            if (b && localStorage.getItem('pipboy-vibrate') === '0') b.innerText = '[VIBRATE: OFF]';
        })();

        // --- v0.56: HEADER HUD GLYPHS (state icons instead of toast chatter) ---
        // sat glyph: dim = off | amber = locked | red blink = unstable-holding.
        // radio glyph: absent = off | phosphor = free-run | amber = LIVE-synced train.
        function updateHud() {
            const sat = document.getElementById('hud-sat');
            if (sat) {
                const live = gpsWatchId !== null;
                const unstable = live && (Date.now() - lastFixAt > 90000);
                sat.style.opacity = live ? '1' : '0.3';
                sat.style.color = unstable ? '#ff3333' : (live ? '#ffb642' : 'var(--pip-color-dim)');
                sat.classList.toggle('hud-blink', !!unstable);
            }
            const rad = document.getElementById('hud-radio');
            if (rad) {
                const on = !!radioCur;
                rad.style.display = on ? '' : 'none';
                if (on) rad.style.color = radioIsSynced(radioCur) ? '#ffb642' : 'var(--pip-color)';
            }
        }

        // Android Chrome THROWS on `new Notification()` from a page (illegal constructor) --
        // native notifications must go through the ServiceWorker registration there.
        // This helper is fully defensive: it can never break the in-app modal above.
        function pushNativeNotification(msg) {
            try {
                if (!('Notification' in window)) return;
                if (Notification.permission !== 'granted') {
                    if (Notification.permission !== 'denied') {
                        Notification.requestPermission().then(function(p) {
                            if (p === 'granted') pushNativeNotification(msg);
                        }).catch(function(){});
                    }
                    return;
                }
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(function(reg) {
                        if (reg && reg.showNotification) {
                            reg.showNotification("PIP-BOY ALERT", { body: msg, icon: "icon.png" });
                        } else {
                            new Notification("PIP-BOY ALERT", { body: msg, icon: "icon.png" });
                        }
                    }).catch(function(){});
                } else {
                    new Notification("PIP-BOY ALERT", { body: msg, icon: "icon.png" });
                }
            } catch (e) { /* native notifications unavailable; in-app modal already shown */ }
        }

        // ================= MAIL PING (v0.44, OPTIONS-gated) =================
        // The unified notification surface: every NEW incoming transmission (msg / quest /
        // item / held-quarantine) buzzes the OS -- but only when it adds signal. If you're
        // already staring at the MAIL tab, the feed itself is the notification.
        function mailPingEnabled() { return localStorage.getItem('pipboy-mail-ping') !== '0'; } // default ON
        function mailPingOs(text) {
            if (!mailPingEnabled()) return;
            if (!document.hidden && mailTabActive()) return;
            pushNativeNotification(text);
        }
        function cycleMailPing() {
            const on = localStorage.getItem('pipboy-mail-ping') === '0';
            localStorage.setItem('pipboy-mail-ping', on ? '1' : '0');
            const btn = document.getElementById('options-ping-btn');
            if (btn) btn.innerText = `[MAIL PING: ${on ? 'ON' : 'OFF'}]`;
            showNotification('MAIL PING ' + (on ? 'ON.' : 'OFF.'));
        }
        function testMailPing() {
            pushNativeNotification('TEST PING: MAIL PINGS ARE LIVE.');
            showNotification('TEST PING FIRED.');
        }
        // Boot label sync (default ON)
        (function() {
            const b = document.getElementById('options-ping-btn');
            if (b && localStorage.getItem('pipboy-mail-ping') === '0') b.innerText = '[MAIL PING: OFF]';
        })();

        // ================= NOTIFICATION PREFERENCES (v0.45, OPTIONS-gated) =================
        // Per-category switches for TRANSMISSION alerts. Each gates BOTH the in-app toast
        // and the OS ping for its category (ping still respects the MAIL PING master
        // switch + the silent-while-reading rule). System notices — radiation, waypoint
        // discoveries, broadcast results — are unaffected on purpose.
        function notifyPref(cat) { return localStorage.getItem('pipboy-notify-' + cat) !== '0'; } // default ON
        function cycleNotify(cat, btnId, label) {
            const on = !notifyPref(cat);
            localStorage.setItem('pipboy-notify-' + cat, on ? '1' : '0');
            const b = document.getElementById(btnId);
            if (b) b.innerText = '[NOTIFY ' + label + ': ' + (on ? 'ON' : 'OFF') + ']';
            showNotification('NOTIFY ' + label + ' ' + (on ? 'ON.' : 'OFF.'));
        }
        // Boot label sync (all default ON)
        (function() {
            [['msg', 'options-nmsg-btn', 'MESSAGES'],
             ['contract', 'options-ncon-btn', 'CONTRACTS'],
             ['link', 'options-nlnk-btn', 'LINKS']].forEach(cfg => {
                const b = document.getElementById(cfg[1]);
                if (b && localStorage.getItem('pipboy-notify-' + cfg[0]) === '0') b.innerText = '[NOTIFY ' + cfg[2] + ': OFF]';
            });
        })();

        // Custom in-app confirmation replacement
        function showCustomPrompt(text, buttons) {
            // v0.45: the shared prompt can carry an image (mail photo viewer) — reset it
            // on every open so an old photo never bleeds into an unrelated query
            const cpImg = document.getElementById('cp-img');
            if (cpImg) { cpImg.style.display = 'none'; cpImg.removeAttribute('src'); }
            document.getElementById('cp-text').innerText = text;
            const btnContainer = document.getElementById('cp-buttons');
            // v0.38: long button lists (e.g. mail recipient picker with a big rolodex)
            // used to spill off-screen -- cap and scroll the stack instead
            btnContainer.style.maxHeight = '65vh';
            btnContainer.style.overflowY = 'auto';
            btnContainer.style.webkitOverflowScrolling = 'touch';
            btnContainer.style.touchAction = 'pan-y';
            btnContainer.innerHTML = '';
            
            buttons.forEach(b => {
                const btnEl = document.createElement('button');
                btnEl.className = 'pip-btn';
                btnEl.innerText = b.label;
                if (b.color) {
                    btnEl.style.borderColor = b.color;
                    btnEl.style.color = b.color;
                }
                btnEl.onclick = () => {
                    document.getElementById('custom-prompt-modal').style.display = 'none';
                    if (b.action) b.action();
                };
                btnContainer.appendChild(btnEl);
            });
            
            // v0.80: always add a close button as fallback
            const closeBtn = document.createElement('button');
            closeBtn.className = 'pip-btn';
            closeBtn.innerText = '[CLOSE]';
            closeBtn.style.borderStyle = 'dashed';
            closeBtn.style.opacity = '0.7';
            closeBtn.style.marginTop = '15px';
            closeBtn.onclick = () => {
                document.getElementById('custom-prompt-modal').style.display = 'none';
            };
            btnContainer.appendChild(closeBtn);
            
            document.getElementById('custom-prompt-modal').style.display = 'flex';
            // v0.59: ensure scroll works on mobile — reset all scroll positions
            const overlay = document.getElementById('custom-prompt-modal');
            if (overlay) { overlay.scrollTop = 0; overlay.style.webkitOverflowScrolling = 'touch'; }
            const mc = overlay ? overlay.querySelector('.modal-content') : null;
            if (mc) { mc.scrollTop = 0; mc.style.webkitOverflowScrolling = 'touch'; }
            const bc = document.getElementById('cp-buttons');
            if (bc) { bc.scrollTop = 0; bc.style.webkitOverflowScrolling = 'touch'; bc.style.touchAction = 'pan-y'; }
        }

        function renderQuests() {
            const container = document.getElementById('quest-tab-direct');
            if (!container) return;
            container.innerHTML = '';
            if (quests.length === 0) return container.innerHTML = '<p style="text-align:center; opacity:0.5;">NO DIRECT QUESTS</p>';
            
            quests.forEach(q => {
                const el = document.createElement('div'); 
                el.className = `item-row ${(q.completed || q.expired || q.abandoned) ? 'quest-completed' : ''}`;
                el.style.flexDirection = 'column';
                el.onclick = () => openQuestActionModal(q.id);
                
                let timeDisplay = `[${q.timeStr || q.time || '--:--'}]`;
                if (q.expired) timeDisplay = `<span style="opacity: 0.5;">[EXPIRED]</span>`;
                else if (q.completed) timeDisplay = `[COMPLETED]`;
                else if (q.abandoned) timeDisplay = `[ABANDONED]`;
                else if (q.expireTime) timeDisplay = `<span id="timer-${q.id}"></span>`;

                let objHTML = q.objectives.map(obj => `<div class="quest-objective">${obj}</div>`).join('');
                
                let giverLine = q.giver ? `<div style="font-size: 0.85rem; opacity: 0.7; padding-left: 15px; margin-top: 2px;">GIVER: ${q.giver}</div>` : '';

                if (q.abandoned) {
                    el.innerHTML = `
                        <div style="display: flex; justify-content: space-between;">
                            <div><del>☒ ${q.name}</del></div>
                            <div style="font-size: 0.9rem; opacity: 0.7;">${timeDisplay}</div>
                        </div>
                        <div style="font-size: 0.85rem; opacity: 0.7; padding-left: 15px; margin-top: 4px; text-decoration: line-through;">LOC: ${q.location} | TYPE: ${q.type}</div>
                        <div style="font-size: 0.85rem; opacity: 0.7; padding-left: 15px; margin-top: 2px; text-decoration: line-through;">${giverLine ? giverLine.replace(/<[^>]*>?/gm, '') : ''}</div>
                    `;
                } else {
                    el.innerHTML = `
                        <div style="display: flex; justify-content: space-between;">
                            <div>${q.completed ? '☑' : (q.expired ? '☒' : '■')} ${q.name}</div>
                            <div style="font-size: 0.9rem; opacity: 0.7;">${timeDisplay}</div>
                        </div>
                        <div style="font-size: 0.85rem; opacity: 0.7; padding-left: 15px; margin-top: 4px;">LOC: ${q.location} | TYPE: ${q.type}</div>
                        ${giverLine}
                        <div style="margin-top: 8px;">${objHTML}</div>
                    `;
                }
                container.appendChild(el);
            });
        }

        // v0.70: Quest tab switching (Direct / Global / Bounties)
        function switchQuestTab(tabId) {
            const subNav = document.getElementById('quest-sub-nav');
            if (!subNav) return;
            subNav.querySelectorAll('.sub-nav-item').forEach(el => {
                const oc = el.getAttribute('onclick') || '';
                el.classList.toggle('active', oc.includes("'" + tabId + "'"));
            });
            document.querySelectorAll('.quest-tab-content').forEach(el => {
                el.classList.remove('active');
                el.style.display = 'none';
            });
            const target = document.getElementById('quest-tab-' + tabId);
            if (target) {
                target.classList.add('active');
                target.style.display = 'block';
            }
            // Render the appropriate tab
            if (tabId === 'direct') renderQuests();
            else if (tabId === 'global') renderGlobalContracts();
            else if (tabId === 'bounties') renderBounties();
        }

        // v0.70: Render global contracts
        function renderGlobalContracts() {
            const container = document.getElementById('quest-tab-global');
            if (!container) return;
            container.innerHTML = '';
            
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            if (isDev) {
                container.innerHTML += '<button class="theme-btn" onclick="createGlobalContract()" style="width:100%; border-style:dashed; margin-bottom:15px;">[+ CREATE GLOBAL CONTRACT]</button>';
            }
            
            const contracts = Object.entries(globalContracts).filter(([id, c]) => c.status === 'open');
            if (contracts.length === 0) {
                container.innerHTML += '<p style="text-align:center; opacity:0.5;">NO GLOBAL CONTRACTS AVAILABLE</p>';
                return;
            }
            
            contracts.forEach(([id, c]) => {
                const el = document.createElement('div');
                el.className = 'item-row';
                el.style.flexDirection = 'column';
                el.onclick = () => openGlobalContractModal(id, c);
                
                const typeLabel = c.type === 'first' ? 'FIRST TO COMPLETE' : (c.type === 'many' ? 'MANY CAN COMPLETE' : 'TIMED');
                const expiresStr = c.expiresAt ? `EXPIRES: ${new Date(c.expiresAt).toLocaleString()}` : 'NO EXPIRY';
                
                el.innerHTML = `
                    <div style="display: flex; justify-content: space-between;">
                        <div>■ ${escapeHtml(c.title)}</div>
                        <div style="font-size: 0.85rem; opacity: 0.7;">${typeLabel}</div>
                    </div>
                    <div style="font-size: 0.85rem; opacity: 0.7; margin-top: 4px;">ISSUED BY: ${escapeHtml(c.issuerName || 'UNKNOWN')}</div>
                    <div style="font-size: 0.85rem; opacity: 0.6; margin-top: 2px;">${expiresStr}</div>
                    <div style="margin-top: 6px; font-size: 0.9rem;">${escapeHtml(c.description || '')}</div>
                    ${c.reward ? `<div style="margin-top: 4px; font-size: 0.85rem; color: #5fc98e;">REWARD: ${escapeHtml(c.reward)}</div>` : ''}
                `;
                container.appendChild(el);
            });
        }

        // v0.70: Render bounties
        function renderBounties() {
            const container = document.getElementById('quest-tab-bounties');
            if (!container) return;
            container.innerHTML = '';
            
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            if (isDev) {
                container.innerHTML += '<button class="theme-btn" onclick="createBounty()" style="width:100%; border-style:dashed; margin-bottom:15px;">[+ POST BOUNTY]</button>';
            }
            
            const openBounties = Object.entries(bounties).filter(([id, b]) => b.status === 'open');
            if (openBounties.length === 0) {
                container.innerHTML += '<p style="text-align:center; opacity:0.5;">NO OPEN BOUNTIES</p>';
                return;
            }
            
            openBounties.forEach(([id, b]) => {
                const el = document.createElement('div');
                el.className = 'item-row';
                el.style.flexDirection = 'column';
                el.onclick = () => openBountyModal(id, b);
                
                const expiresStr = b.expiresAt ? `EXPIRES: ${new Date(b.expiresAt).toLocaleString()}` : 'NO EXPIRY';
                
                el.innerHTML = `
                    <div style="display: flex; justify-content: space-between;">
                        <div>☠ ${escapeHtml(b.targetName)}</div>
                        <div style="font-size: 0.85rem; color: #ff3333;">BOUNTY</div>
                    </div>
                    <div style="font-size: 0.85rem; opacity: 0.7; margin-top: 4px;">POSTED BY: ${escapeHtml(b.issuerName || 'UNKNOWN')}</div>
                    <div style="font-size: 0.85rem; opacity: 0.6; margin-top: 2px;">${expiresStr}</div>
                    <div style="margin-top: 6px; font-size: 0.9rem;">${escapeHtml(b.reason || '')}</div>
                    ${b.reward ? `<div style="margin-top: 4px; font-size: 0.85rem; color: #ffb642;">REWARD: ${escapeHtml(b.reward)}</div>` : ''}
                `;
                container.appendChild(el);
            });
        }

        // v0.70: Create global contract (overseer only)
        function createGlobalContract() {
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            if (!isDev) { showNotification('OVERSEER ACCESS REQUIRED'); return; }
            
            // v0.72: Open the global contract form modal instead of step-by-step prompts
            document.getElementById('gc-title').value = '';
            document.getElementById('gc-desc').value = '';
            document.getElementById('gc-reward').value = '';
            document.getElementById('gc-expires').value = '';
            window.selectedGlobalContractType = 'first';
            updateGlobalContractTypeDisplay();
            document.getElementById('compose-global-contract-modal').style.display = 'flex';
        }

        // v0.72: Select global contract type
        function selectGlobalContractType(type) {
            window.selectedGlobalContractType = type;
            updateGlobalContractTypeDisplay();
        }

        function updateGlobalContractTypeDisplay() {
            const type = window.selectedGlobalContractType || 'first';
            const labels = {
                'first': 'FIRST TO COMPLETE',
                'many': 'MANY CAN COMPLETE',
                'timed': 'TIMED'
            };
            const display = document.getElementById('gc-type-display');
            if (display) display.innerText = 'Selected: ' + (labels[type] || 'FIRST TO COMPLETE');
            
            // Update button styles
            document.querySelectorAll('.gc-type-btn').forEach(btn => {
                btn.style.borderColor = '';
                btn.style.color = '';
            });
            const selectedBtn = document.querySelector('.gc-type-btn[onclick*="' + type + '"]');
            if (selectedBtn) {
                selectedBtn.style.borderColor = 'var(--pip-color)';
                selectedBtn.style.color = 'var(--pip-color)';
            }
        }

        // v0.72: Submit global contract form
        function submitGlobalContractForm() {
            const title = document.getElementById('gc-title').value.trim();
            const description = document.getElementById('gc-desc').value.trim();
            const reward = document.getElementById('gc-reward').value.trim();
            const expiresHours = document.getElementById('gc-expires').value.trim();
            const type = window.selectedGlobalContractType || 'first';
            
            if (!title) { showNotification('TITLE REQUIRED'); return; }
            
            const contractId = 'gc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const contract = {
                title: title,
                description: description || '',
                issuerUid: localStorage.getItem('pipboy-uid') || 'unknown',
                issuerName: userProfile.name || 'UNKNOWN',
                type: type,
                reward: reward || '',
                expiresAt: null,
                status: 'open',
                completedBy: type === 'many' ? [] : null,
                createdAt: Date.now()
            };
            
            if (expiresHours && !isNaN(parseFloat(expiresHours))) {
                contract.expiresAt = Date.now() + (parseFloat(expiresHours) * 3600000);
            }
            
            window.firebaseSet(window.firebaseRef(window.db, 'globalContracts/' + contractId), contract)
                .then(() => {
                    showNotification('GLOBAL CONTRACT CREATED');
                    closeModals();
                    renderGlobalContracts();
                })
                .catch(err => showNotification('ERROR: ' + err.message));
        }

        // v0.70: Create bounty (overseer only)
        // v0.70: Create bounty (overseer only)
        function createBounty() {
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            if (!isDev) { showNotification('OVERSEER ACCESS REQUIRED'); return; }
            
            // v0.72: Open the bounty form modal instead of step-by-step prompts
            document.getElementById('bounty-reason').value = '';
            document.getElementById('bounty-reward').value = '';
            document.getElementById('bounty-expires').value = '';
            window.selectedBountyTarget = null;
            populateBountyTargetList();
            document.getElementById('compose-bounty-modal').style.display = 'flex';
        }

        // v0.72: Populate bounty target list
        function populateBountyTargetList() {
            const listEl = document.getElementById('bounty-target-list');
            if (!listEl) return;
            
            // Show list of known wastelanders (beacons + rolodex)
            const wastelanders = [];
            const seenUids = new Set();
            
            // Add all beacons (live and cold)
            Object.entries(lastKnownBeaconData || {}).forEach(([uid, b]) => {
                if (!seenUids.has(uid)) {
                    wastelanders.push({ uid, name: b.name || 'UNKNOWN' });
                    seenUids.add(uid);
                }
            });
            
            // Add rolodex contacts (if not already in beacons)
            rolodex.forEach(c => {
                if (!seenUids.has(c.uid)) {
                    wastelanders.push({ uid: c.uid, name: c.name || 'UNKNOWN' });
                    seenUids.add(c.uid);
                }
            });
            
            if (wastelanders.length === 0) {
                listEl.innerHTML = '<p style="opacity:0.5;">NO WASTELANDERS FOUND - SCAN DATACARDS FIRST</p>';
                return;
            }
            
            // Sort by name
            wastelanders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            
            listEl.innerHTML = wastelanders.map(w => 
                `<div style="padding: 6px; cursor: pointer; border-bottom: 1px dashed var(--pip-color-dim);" onclick="selectBountyTarget('${w.uid}', '${escapeHtml(w.name)}')">${escapeHtml(w.name)}</div>`
            ).join('');
        }

        // v0.72: Select bounty target
        function selectBountyTarget(uid, name) {
            window.selectedBountyTarget = { uid, name };
            const display = document.getElementById('bounty-target-display');
            if (display) display.innerText = 'Target: ' + name;
        }

        // v0.72: Submit bounty form
        function submitBountyForm() {
            if (!window.selectedBountyTarget) { showNotification('TARGET REQUIRED'); return; }
            
            const reason = document.getElementById('bounty-reason').value.trim();
            const reward = document.getElementById('bounty-reward').value.trim();
            const expiresHours = document.getElementById('bounty-expires').value.trim();
            
            const bountyId = 'bty_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const bounty = {
                targetUid: window.selectedBountyTarget.uid,
                targetName: window.selectedBountyTarget.name,
                issuerUid: localStorage.getItem('pipboy-uid') || 'unknown',
                issuerName: userProfile.name || 'UNKNOWN',
                reason: reason || '',
                reward: reward || '',
                expiresAt: null,
                status: 'open',
                claimedBy: null,
                createdAt: Date.now()
            };
            
            if (expiresHours && !isNaN(parseFloat(expiresHours))) {
                bounty.expiresAt = Date.now() + (parseFloat(expiresHours) * 3600000);
            }
            
            window.firebaseSet(window.firebaseRef(window.db, 'bounties/' + bountyId), bounty)
                .then(() => {
                    showNotification('BOUNTY POSTED');
                    closeModals();
                    renderBounties();
                })
                .catch(err => showNotification('ERROR: ' + err.message));
        }

        // v0.70: Open global contract modal
        function openGlobalContractModal(id, c) {
            const myUid = localStorage.getItem('pipboy-uid');
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            const canComplete = c.status === 'open' && (!c.expiresAt || c.expiresAt > Date.now());
            const alreadyCompleted = c.type === 'many' && c.completedBy && c.completedBy.includes(myUid);
            
            const buttons = [];
            if (canComplete && !alreadyCompleted) {
                buttons.push({ label: 'COMPLETE CONTRACT', action: () => completeGlobalContract(id, c) });
            }
            if (isDev && c.status === 'open') {
                buttons.push({ label: 'VERIFY (OVERSEER)', action: () => verifyGlobalContract(id, c) });
                buttons.push({ label: 'CANCEL CONTRACT', color: '#ff3333', action: () => cancelGlobalContract(id) });
            }
            buttons.push({ label: 'CLOSE', action: () => {} });
            
            const typeLabel = c.type === 'first' ? 'FIRST TO COMPLETE' : (c.type === 'many' ? 'MANY CAN COMPLETE' : 'TIMED');
            const statusInfo = alreadyCompleted ? 'YOU COMPLETED THIS' : (c.status === 'open' ? 'OPEN' : c.status.toUpperCase());
            
            showCustomPrompt(`${escapeHtml(c.title)}\n\n${escapeHtml(c.description || '')}\n\nTYPE: ${typeLabel}\nSTATUS: ${statusInfo}${c.reward ? '\nREWARD: ' + escapeHtml(c.reward) : ''}`, buttons);
        }

        // v0.70: Complete global contract
        function completeGlobalContract(id, c) {
            const myUid = localStorage.getItem('pipboy-uid');
            const myName = userProfile.name || 'UNKNOWN';
            
            const updates = {};
            if (c.type === 'first') {
                updates.status = 'completed';
                updates.completedBy = myUid;
                updates.verifiedBy = null; // needs verification
            } else if (c.type === 'many') {
                const completedBy = c.completedBy || [];
                if (!completedBy.includes(myUid)) {
                    completedBy.push(myUid);
                    updates.completedBy = completedBy;
                }
            }
            
            window.firebaseUpdate(window.firebaseRef(window.db, 'globalContracts/' + id), updates)
                .then(() => {
                    showNotification('CONTRACT COMPLETED - AWAITING VERIFICATION');
                    renderGlobalContracts();
                })
                .catch(err => showNotification('ERROR: ' + err.message));
        }

        // v0.70: Verify global contract (overseer)
        function verifyGlobalContract(id, c) {
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            if (!isDev) { showNotification('OVERSEER ACCESS REQUIRED'); return; }
            
            window.firebaseUpdate(window.firebaseRef(window.db, 'globalContracts/' + id), { verifiedBy: userProfile.name || 'OVERSEER' })
                .then(() => {
                    showNotification('CONTRACT VERIFIED');
                    renderGlobalContracts();
                })
                .catch(err => showNotification('ERROR: ' + err.message));
        }

        // v0.70: Cancel global contract (overseer)
        function cancelGlobalContract(id) {
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            if (!isDev) { showNotification('OVERSEER ACCESS REQUIRED'); return; }
            
            window.firebaseRemove(window.firebaseRef(window.db, 'globalContracts/' + id))
                .then(() => {
                    showNotification('CONTRACT CANCELLED');
                    renderGlobalContracts();
                })
                .catch(err => showNotification('ERROR: ' + err.message));
        }

        // v0.70: Open bounty modal
        function openBountyModal(id, b) {
            const myUid = localStorage.getItem('pipboy-uid');
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            const canClaim = b.status === 'open' && b.targetUid !== myUid && (!b.expiresAt || b.expiresAt > Date.now());
            
            const buttons = [];
            if (canClaim) {
                buttons.push({ label: 'CLAIM BOUNTY (SCAN TARGET)', action: () => claimBounty(id, b) });
            }
            if (isDev && b.status === 'open') {
                buttons.push({ label: 'VERIFY (OVERSEER)', action: () => verifyBounty(id, b) });
                buttons.push({ label: 'CANCEL BOUNTY', color: '#ff3333', action: () => cancelBounty(id) });
            }
            buttons.push({ label: 'CLOSE', action: () => {} });
            
            const statusInfo = b.status === 'open' ? 'OPEN' : b.status.toUpperCase();
            
            showCustomPrompt(`☠ BOUNTY: ${escapeHtml(b.targetName)}\n\n${escapeHtml(b.reason || '')}\n\nSTATUS: ${statusInfo}${b.reward ? '\nREWARD: ' + escapeHtml(b.reward) : ''}`, buttons);
        }

        // v0.70: Claim bounty (scan target's datacard)
        function claimBounty(id, b) {
            showNotification('SCAN TARGET\'S DATACARD TO CLAIM BOUNTY');
            // Store pending bounty claim
            window.pendingBountyClaim = { id, bounty: b };
            // Start QR scanner
            startQRScanner();
        }

        // v0.70: Verify bounty (overseer)
        function verifyBounty(id, b) {
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            if (!isDev) { showNotification('OVERSEER ACCESS REQUIRED'); return; }
            
            window.firebaseUpdate(window.firebaseRef(window.db, 'bounties/' + id), { 
                status: 'claimed',
                verifiedBy: userProfile.name || 'OVERSEER'
            })
                .then(() => {
                    showNotification('BOUNTY VERIFIED');
                    renderBounties();
                })
                .catch(err => showNotification('ERROR: ' + err.message));
        }

        // v0.70: Cancel bounty (overseer)
        function cancelBounty(id) {
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            if (!isDev) { showNotification('OVERSEER ACCESS REQUIRED'); return; }
            
            window.firebaseRemove(window.firebaseRef(window.db, 'bounties/' + id))
                .then(() => {
                    showNotification('BOUNTY CANCELLED');
                    renderBounties();
                })
                .catch(err => showNotification('ERROR: ' + err.message));
        }

        function getFactionRelation(rep) {
            if (rep <= -10) return { text: "HOSTILE", color: "#ff3333" };
            if (rep < 20) return { text: "CAUTIOUS", color: "#ffff33" };
            if (rep < 50) return { text: "NEUTRAL", color: "var(--pip-color)" };
            return { text: "ALLIED", color: "#33ff33" };
        }

        function renderFactions() {
            const container = document.getElementById('factions-list-display');
            container.innerHTML = '';
            
            factions.forEach(f => {
                const relation = getFactionRelation(f.rep);

                const el = document.createElement('div');
                el.className = 'item-row';
                el.style.flexDirection = 'column';
                el.style.cursor = 'pointer';
                el.style.marginBottom = '10px';
                
                // Add left click for detail view, and right click / long press for quick edit
                el.setAttribute('onclick', `openFactionDetail(${f.id})`);
                el.setAttribute('oncontextmenu', `openFactionAuth('EDIT_SPECIFIC', ${f.id}); return false;`);
                
                let memberPreview = '';
                if (f.leader) {
                    memberPreview += `LEADER: ${f.leader}`;
                }
                if (f.members && f.members.length > 0) {
                    if (memberPreview !== '') memberPreview += ' | ';
                    memberPreview += `MEMBERS: ${f.members.join(', ')}`;
                }

                let secondaryLine = '';
                if (memberPreview !== '') {
                    secondaryLine = `<div style="font-size: 0.85rem; opacity: 0.6; margin-top: 5px; font-style: italic;">${memberPreview}</div>`;
                }

                el.innerHTML = `
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--pip-color-dim); padding-bottom: 5px; margin-bottom: 5px;">
                        <div style="font-weight: bold; font-size: 1.3rem;">${f.name}</div>
                        <div style="font-weight: bold; color: ${relation.color}; text-shadow: 0 0 5px ${relation.color};">[${relation.text}]</div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 1rem; opacity: 0.8; line-height: 1.2; padding-right: 15px; flex-grow: 1;">
                            ${f.blurb}
                            ${secondaryLine}
                        </div>
                        <div style="display: flex; gap: 5px; align-items: center; border: 1px dashed var(--pip-color-dim); padding: 5px;" onclick="event.stopPropagation();">
                            <button class="theme-btn" onclick="openRepAuthModal(${f.id}, false)" style="padding: 0 8px;">-</button>
                            <span style="font-weight: bold; width: 45px; text-align: center;">${f.rep}</span>
                            <button class="theme-btn" onclick="openRepAuthModal(${f.id}, true)" style="padding: 0 8px;">+</button>
                        </div>
                    </div>
                `;
                container.appendChild(el);
            });
        }

        // Stepper helper: readonly display inputs adjusted only via +/- buttons
        // (native number keyboards are banned per CORE_DIRECTIVES rule 6)
        function stepNumberInput(inputId, delta, min) {
            const el = document.getElementById(inputId);
            if (!el) return;
            let v = parseInt(el.value, 10);
            if (isNaN(v)) v = 0;
            v += delta;
            if (min !== undefined && v < min) v = min;
            el.value = v;
        }

        function openRepAuthModal(id, isPositive) {
            pendingAuthAction = 'REP';
            pendingRepId = id;
            pendingRepIsPositive = isPositive;
            document.getElementById('auth-code').value = '';
            document.getElementById('rep-amount').value = '5'; // default
            
            document.getElementById('auth-amount-group').style.display = 'block';
            
            // visually indicate if we are adding or subtracting in the modal title
            const titleEl = document.getElementById('auth-title');
            titleEl.innerText = isPositive ? "OVERSEER AUTHORIZATION (+)" : "OVERSEER AUTHORIZATION (-)";
            document.getElementById('auth-desc').innerText = "Enter security code to modify faction reputation.";
            
            document.getElementById('auth-modal').style.display = 'flex';
        }

        function openFactionDetail(id) {
            const f = factions.find(fac => fac.id === id);
            if (!f) return;
            
            const relation = getFactionRelation(f.rep);
            
            document.getElementById('fd-name').innerText = f.name;
            document.getElementById('fd-relation').innerText = relation.text;
            document.getElementById('fd-relation').style.color = relation.color;
            document.getElementById('fd-rep').innerText = f.rep;
            
            // Render Leader dynamically
            const bioEl = document.getElementById('fd-bio');
            if (f.leader) {
                bioEl.innerHTML = `<span style="font-weight:bold; font-size:1.2rem;">LEADER:</span> <span style="font-size:1.2rem;">${f.leader}</span><br><br>` + (f.bio || "No expanded lore available in the archives.");
            } else {
                bioEl.innerText = f.bio || "No expanded lore available in the archives.";
            }
            
            const membersUl = document.getElementById('fd-members');
            membersUl.innerHTML = '';
            if (f.members && f.members.length > 0) {
                f.members.forEach(m => {
                    const li = document.createElement('li');
                    li.innerText = m;
                    membersUl.appendChild(li);
                });
            } else {
                membersUl.innerHTML = '<li><span style="opacity:0.5;">No known notable members.</span></li>';
            }

            document.getElementById('faction-detail-modal').style.display = 'flex';
        }

        function openFactionAuth(action, specificId = null) {
            pendingAuthAction = action; // 'ADD', 'EDIT', or 'EDIT_SPECIFIC'
            if (specificId !== null) pendingRepId = specificId;
            
            document.getElementById('auth-code').value = '';
            document.getElementById('auth-amount-group').style.display = 'none';
            document.getElementById('auth-title').innerText = "OVERSEER AUTHORIZATION";
            document.getElementById('auth-desc').innerText = `Enter security code to access faction database.`;
            document.getElementById('auth-modal').style.display = 'flex';
        }

        function confirmAuth() {
            const code = document.getElementById('auth-code').value;
            
            if (code !== '5318008') {
                closeModals();
                showNotification("ACCESS DENIED: INVALID AUTHORIZATION CODE.");
                return;
            }

            if (pendingAuthAction === 'TOGGLE_DEV') {
                localStorage.setItem('pipboy-dev-mode', 'true');
                showNotification("OVERSEER MODE ENABLED. ADMIN UI UNLOCKED.");
                closeModals();

                // We need to re-evaluate the current tab to reveal the buttons immediately
                const activeMainTab = document.querySelector('.nav-tabs .nav-item.active').innerText.toLowerCase();
                switchMainTab(activeMainTab);

            } else if (pendingAuthAction === 'TOGGLE_DEV_OFF') {
                // v0.48: PIN-verified lockout (moved out of toggleDevMode's one-tap path)
                doDevDisable();
                showNotification("OVERSEER MODE DISABLED. UI RESTRICTED.");
                closeModals();

            } else if (pendingAuthAction === 'REP') {
                let amount = parseInt(document.getElementById('rep-amount').value, 10);
                if (isNaN(amount) || amount <= 0) {
                    showNotification("INVALID AMOUNT. PLEASE ENTER A NUMBER GREATER THAN 0.");
                    return;
                }

                const f = factions.find(fac => fac.id === pendingRepId);
                if (f) {
                    if (!pendingRepIsPositive) amount = -amount;
                    f.rep += amount;
                    
                    saveToStorage();
                    if (document.getElementById('tab-data').classList.contains('active') && currentDataTab === 'factions') {
                        renderFactions();
                    }
                    showNotification("REPUTATION UPDATED SUCCESSFULLY.");
                }
                closeModals();
            } else if (pendingAuthAction === 'ADD') {
                closeModals();
                document.getElementById('fac-name').value = '';
                document.getElementById('fac-rep').value = '0';
                document.getElementById('fac-blurb').value = '';
                document.getElementById('add-faction-modal').style.display = 'flex';
            } else if (pendingAuthAction === 'EDIT' || pendingAuthAction === 'EDIT_SPECIFIC') {
                closeModals();
                const select = document.getElementById('fac-edit-select'); // v0.55: now a themed picker input
                if (factions.length === 0) {
                    facEditId = null;
                    select.value = 'NO FACTIONS ON FILE';
                    populateEditFaction();
                } else {
                    const wantId = parseInt(pendingRepId, 10);
                    facEditId = (pendingAuthAction === 'EDIT_SPECIFIC' && factions.some(f => f.id === wantId)) ? wantId : factions[0].id;
                    select.value = (factions.find(f => f.id === facEditId).name || 'UNKNOWN').toUpperCase();
                    populateEditFaction();
                }
                document.getElementById('edit-faction-modal').style.display = 'flex';
            }
        }

        function saveNewFaction() {
            const name = document.getElementById('fac-name').value.trim() || 'UNKNOWN FACTION';
            const rep = parseInt(document.getElementById('fac-rep').value, 10) || 0;
            const blurb = document.getElementById('fac-blurb').value.trim() || 'No data available.';
            const bio = document.getElementById('fac-bio').value.trim() || '';
            const rawMembers = document.getElementById('fac-members').value;
            const members = rawMembers ? rawMembers.split(',').map(m => m.trim()) : [];
            
            factions.push({ id: Date.now(), name: name.toUpperCase(), rep: rep, blurb: blurb, bio: bio, members: members });
            saveToStorage();
            if (currentDataTab === 'factions') renderFactions();
            closeModals();
        }

        // v0.55: which faction the editor is pointed at (themed picker replaced the select)
        let facEditId = null;
        function pickFactionToEdit() {
            if (!factions.length) { showNotification('NO FACTIONS ON FILE.'); return; }
            const buttons = factions.map(f => ({
                label: (f.name || 'UNKNOWN').toUpperCase(),
                action: () => {
                    facEditId = f.id;
                    document.getElementById('fac-edit-select').value = (f.name || 'UNKNOWN').toUpperCase();
                    populateEditFaction();
                }
            }));
            buttons.push({ label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} });
            showCustomPrompt('EDIT WHICH FACTION?', buttons);
        }

        function populateEditFaction() {
            const id = facEditId; // v0.55
            const f = factions.find(fac => fac.id === id);
            if (f) {
                document.getElementById('edit-fac-name').value = f.name;
                document.getElementById('edit-fac-rep').value = f.rep;
                document.getElementById('edit-fac-blurb').value = f.blurb;
                document.getElementById('edit-fac-bio').value = f.bio || '';
                document.getElementById('edit-fac-members').value = f.members ? f.members.join(', ') : '';
            } else {
                document.getElementById('edit-fac-name').value = '';
                document.getElementById('edit-fac-rep').value = '';
                document.getElementById('edit-fac-blurb').value = '';
                document.getElementById('edit-fac-bio').value = '';
                document.getElementById('edit-fac-members').value = '';
            }
        }

        function saveEditFaction() {
            const id = facEditId; // v0.55
            const f = factions.find(fac => fac.id === id);
            if (f) {
                f.name = (document.getElementById('edit-fac-name').value.trim() || 'UNKNOWN FACTION').toUpperCase();
                f.rep = parseInt(document.getElementById('edit-fac-rep').value, 10) || 0;
                f.blurb = document.getElementById('edit-fac-blurb').value.trim() || 'No data available.';
                f.bio = document.getElementById('edit-fac-bio').value.trim() || '';
                const rawMembers = document.getElementById('edit-fac-members').value;
                f.members = rawMembers ? rawMembers.split(',').map(m => m.trim()).filter(m => m !== '') : [];
                
                saveToStorage();
                if (currentDataTab === 'factions') renderFactions();
                closeModals();
            }
        }

        function deleteFaction() {
            if (facEditId === null) { showNotification('PICK A FACTION FIRST.'); return; } // v0.55
            const id = facEditId;
            factions = factions.filter(fac => fac.id !== id);
            saveToStorage();
            if (currentDataTab === 'factions') renderFactions();
            closeModals();
        }

        let activeQuestId = null;

        function openQuestActionModal(id) {
            activeQuestId = id;
            const q = quests.find(x => x.id === id);
            if (!q) return;

            document.getElementById('qa-title').innerText = q.name;
            document.getElementById('qa-giver').innerText = "GIVER: " + (q.giver || "UNKNOWN");
            document.getElementById('qa-loc').innerText = "LOCATION: " + (q.location || "UNKNOWN");
            
            let timeText = q.timeStr || "--:--";
            if (q.expired) timeText += " (EXPIRED)";
            else if (q.abandoned) timeText += " (ABANDONED)";
            document.getElementById('qa-time').innerText = "TIME LIMIT: " + timeText;

            let objHTML = q.objectives.map(o => `<div>- ${o}</div>`).join('');
            document.getElementById('qa-obj').innerHTML = objHTML;

            const toggleBtn = document.getElementById('qa-toggle-btn');
            const abandonBtn = document.getElementById('qa-abandon-btn');

            if (q.completed) {
                toggleBtn.style.display = 'block';
                toggleBtn.innerText = "MARK AS INCOMPLETE";
                abandonBtn.style.display = 'none';
            } else if (q.abandoned) {
                toggleBtn.style.display = 'none';
                abandonBtn.style.display = 'block';
                abandonBtn.innerText = "RE-ENGAGE QUEST";
                abandonBtn.onclick = executeQuestReengage;
            } else {
                toggleBtn.style.display = 'block';
                toggleBtn.innerText = "MARK AS COMPLETE";
                abandonBtn.style.display = 'block';
                abandonBtn.innerText = "ABANDON QUEST";
                abandonBtn.onclick = executeQuestAbandon;
            }

            document.getElementById('quest-action-modal').style.display = 'flex';
        }

        function executeQuestToggle() {
            if (!activeQuestId) return;
            const quest = quests.find(q => q.id === activeQuestId);
            if (!quest) return;

            // If it's already completed and they are UN-checking it, just do it.
            if (quest.completed) {
                quest.completed = false;
                if (quest.giver && quest.giver !== "UNKNOWN WASTELANDER") {
                    const linkedFaction = factions.find(f => f.name === quest.giver);
                    if (linkedFaction) linkedFaction.rep -= 10;
                }
                saveToStorage();
                renderQuests();
                closeModals();
                return;
            }

            // If they are trying to COMPLETE it, ask for confirmation to prevent accidental clicks
            showCustomPrompt(`MARK "${quest.name}" AS COMPLETE?`, [
                {
                    label: "YES, COMPLETE QUEST",
                    action: () => {
                        quest.completed = true;
                        // v0.63: track quest completion in fun stats
                        bumpFunStat('questsCompleted', 1);
                        // Track quest type if available (steal/fetch/assist)
                        if (quest.type === 'STEAL') bumpFunStat('steals', 1);
                        else if (quest.type === 'FETCH') bumpFunStat('fetches', 1);
                        else if (quest.type === 'ASSIST') bumpFunStat('assists', 1);
                        // v0.31: player-issued CONTRACTs write fulfillment back to the
                        // original mailbox letter so the GIVER's outbox flips to
                        // "CONTRACT FULFILLED" on their next outbox status refresh.
                        if (quest.contractKey && window.db) {
                            try { window.firebaseSet(window.firebaseRef(window.db, 'mail/' + myMailUid + '/' + quest.contractKey + '/fulfilled'), true).catch(()=>{}); } catch(e){}
                        }
                        // v0.44 item-17: ALSO mail the giver a fulfil-notice letter so the
                        // news arrives as an actual transmission (pings their MAIL PING),
                        // not just an outbox status flip on their next lazy refresh
                        if (quest.contractGiver) {
                            queueMail(quest.contractGiver, 'msg', {
                                text: 'CONTRACT FULFILLED: ' + quest.name + ' — BY ' + String(userProfile.name || 'UNKNOWN').toUpperCase(),
                                fulfilledTitle: quest.name
                            }, 'FULFILLED: ' + quest.name);
                        }
                        if (quest.giver && quest.giver !== "UNKNOWN WASTELANDER") {
                            const linkedFaction = factions.find(f => f.name === quest.giver);
                            if (linkedFaction) {
                                linkedFaction.rep += 10;
                                showNotification(`QUEST COMPLETE! +10 REP WITH ${linkedFaction.name}`);
                            }
                        } else {
                            showNotification(`QUEST COMPLETE: ${quest.name}`);
                        }
                        saveToStorage(); 
                        renderQuests(); 
                        closeModals();
                    }
                },
                {
                    label: "CANCEL",
                    color: "var(--pip-color-dim)",
                    action: () => { /* Do nothing */ }
                }
            ]);
        }

        function executeQuestAbandon() {
            if (!activeQuestId) return;
            const quest = quests.find(q => q.id === activeQuestId);
            if (quest) {
                quest.abandoned = true;
                // v0.63: track quest abandonment in fun stats
                bumpFunStat('questsAbandoned', 1);
                saveToStorage();
                renderQuests();
                closeModals();
            }
        }

        function executeQuestReengage() {
            if (!activeQuestId) return;
            const quest = quests.find(q => q.id === activeQuestId);
            if (quest) {
                showCustomPrompt(`WHAT WOULD YOU LIKE TO DO WITH "${quest.name}"?`, [
                    {
                        label: "RE-ENGAGE QUEST",
                        action: () => {
                            quest.abandoned = false;
                            saveToStorage();
                            renderQuests();
                            closeModals();
                        }
                    },
                    {
                        label: "PERMANENTLY DELETE",
                        color: "#ff3333",
                        action: () => {
                            quests = quests.filter(q => q.id !== activeQuestId);
                            saveToStorage();
                            renderQuests();
                            closeModals();
                        }
                    },
                    {
                        label: "CANCEL",
                        color: "var(--pip-color-dim)",
                        action: () => { /* Do nothing */ }
                    }
                ]);
            }
        }

        // Modals Logic
        let pendingAuthAction = null;
        let pendingRepId = null;
        let pendingRepIsPositive = true;

        function openActionModal(id) {
            activeItemId = id; const item = items.find(i => i.id === id); if (!item) return;
            document.getElementById('action-title').innerText = item.name; document.getElementById('action-effects').innerText = item.effects;
            const pBtn = document.getElementById('btn-primary-action');
            if (item.type === 'aid') { pBtn.innerText = 'CONSUME'; pBtn.style.display = 'block'; pBtn.onclick = () => modifyItem(-1); } 
            else if (item.type === 'weapons' || item.type === 'apparel') { pBtn.innerText = item.equipped ? 'UNEQUIP' : 'EQUIP'; pBtn.style.display = 'block'; pBtn.onclick = () => toggleEquip(id); } 
            else { pBtn.style.display = 'none'; }
            
            // Hide dev buttons unless dev mode is active
            const isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            document.getElementById('dev-add-one-btn').style.display = isDev ? 'block' : 'none';
            document.getElementById('dev-remove-one-btn').style.display = isDev ? 'block' : 'none';

            document.getElementById('action-modal').style.display = 'flex';
        }
        function openAddModal() { document.getElementById('add-name').value = ''; document.getElementById('add-modal').style.display = 'flex'; }
        function openAddQuestModal() {
            document.getElementById('q-name').value = '';
            // v0.55: selects became themed prompt pickers; defaults ride state vars
            qTypeVal = 'MAIN'; document.getElementById('q-type').value = 'MAIN QUEST';
            qGiverVal = 'UNKNOWN WASTELANDER'; document.getElementById('q-giver').value = 'UNKNOWN WASTELANDER';
            document.getElementById('add-quest-modal').style.display = 'flex';
        }

        // v0.55: quest composer pickers -- themed prompts, no native dropdown chrome
        let qTypeVal = 'MAIN';
        let qGiverVal = 'UNKNOWN WASTELANDER';
        function pickQuestType() {
            showCustomPrompt('QUEST CLASSIFICATION?', [
                { label: 'MAIN QUEST', action: () => { qTypeVal = 'MAIN'; document.getElementById('q-type').value = 'MAIN QUEST'; } },
                { label: 'SIDE QUEST', action: () => { qTypeVal = 'SIDE'; document.getElementById('q-type').value = 'SIDE QUEST'; } },
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }
        function pickQuestGiver() {
            const buttons = factions.map(f => ({
                label: (f.name || 'UNKNOWN').toUpperCase(),
                action: () => { qGiverVal = f.name; document.getElementById('q-giver').value = (f.name || 'UNKNOWN').toUpperCase(); }
            }));
            buttons.unshift({ label: 'UNKNOWN WASTELANDER', action: () => { qGiverVal = 'UNKNOWN WASTELANDER'; document.getElementById('q-giver').value = 'UNKNOWN WASTELANDER'; } });
            buttons.push({ label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} });
            showCustomPrompt('CONTRACT ISSUER (GIVEN BY)?', buttons);
        }
        
        let tempWpLat = null;
        let tempWpLng = null;
        function openAddWaypointModal(lat, lng) {
            document.getElementById('wp-name').value = '';
            if (lat !== undefined && lng !== undefined) {
                tempWpLat = lat; tempWpLng = lng;
            } else if (pipMap) {
                const c = pipMap.getCenter();
                tempWpLat = c.lat; tempWpLng = c.lng;
            }
            // v0.50: Overseer mode reveals zone-drops on the same placement flow
            const oz = document.getElementById('wp-overseer-zones');
            if (oz) oz.style.display = (localStorage.getItem('pipboy-dev-mode') === 'true') ? 'block' : 'none';
            document.getElementById('add-waypoint-modal').style.display = 'flex';
        }

        // v0.55: native <select> purged -- a themed picker lists your markers instead.
        function openRemoveWaypointModal() {
            if (!waypoints.length) { showNotification('NO MARKERS TO REMOVE.'); return; }
            const buttons = waypoints.map(wp => ({
                label: '✖ ' + wp.name.toUpperCase(),
                action: () => showCustomPrompt('REMOVE MARKER "' + wp.name.toUpperCase() + '" FROM THIS UNIT\'S MAP?', [
                    { label: 'REMOVE IT', color: '#ff3333', action: () => deleteWaypointById(wp.id) },
                    { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
                ])
            }));
            buttons.push({ label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} });
            showCustomPrompt('REMOVE WHICH MAP MARKER?', buttons);
            // v0.57: scroll the button stack to the top so the first markers are visible
            const btnC = document.getElementById('cp-buttons');
            if (btnC) btnC.scrollTop = 0;
        }
        
        function closeModals() { 
            document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); 
            activeItemId = null; 
            if (html5QrCode) stopQRScanner();
        }

        let html5QrCode = null;

        function startQRScanner() {
            document.getElementById('qr-scan-modal').style.display = 'flex';
            if (!html5QrCode) {
                html5QrCode = new Html5Qrcode("qr-reader");
            }
            
            // By not specifying aspectRatio, it will use the default camera feed dimensions.
            // We use 'environment' to specifically request the back camera on phones.
            const config = { 
                fps: 10, 
                qrbox: function(viewfinderWidth, viewfinderHeight) {
                    let minEdgePercentage = 0.70; // 70% of the smallest edge
                    let minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                    let qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
                    return {
                        width: qrboxSize,
                        height: qrboxSize
                    };
                }
            };
            
            // Run instantly to prevent iOS from blocking the permission request
            html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
            .then(() => {
                // Camera permission popup resolved; restore fullscreen if it was dropped
                restoreFullscreenIfDesired();
            })
            .catch(err => {
                console.error(err);
                document.getElementById('qr-scan-modal').style.display = 'none';
                restoreFullscreenIfDesired();
                showNotification("CAMERA BLOCKED: MUST USE HTTPS SECURE SERVER OR DEVICE PERMISSION DENIED.");
            });
        }

        function stopQRScanner() {
            // First, immediately hide the modal so the user isn't stuck waiting
            document.getElementById('qr-scan-modal').style.display = 'none';
            
            // Then cleanly shut down the camera hardware in the background
            if (html5QrCode && html5QrCode.isScanning) {
                return html5QrCode.stop().then(() => {
                    html5QrCode.clear();
                }).catch(err => {
                    console.error("Error stopping scanner:", err);
                    html5QrCode.clear();
                });
            }
            return Promise.resolve();
        }

        function onScanSuccess(decodedText, decodedResult) {
            stopQRScanner();
            document.getElementById('qr-scan-modal').style.display = 'none';

            // v0.31: profile datacards are plain-text, not JSON — route them first
            if (typeof decodedText === 'string' && decodedText.indexOf('poxboy:') === 0) {
                handleDatacardScan(decodedText);
                return;
            }

            try {
                const data = JSON.parse(decodedText);
                
                if (data.action === 'TRADE_ITEM') {
                    // Look if we already have it
                    const existing = items.find(i => i.name === data.item.name && i.type === data.item.type);
                    if (existing) {
                        existing.quantity += 1;
                    } else {
                        const newItem = {...data.item};
                        newItem.id = Date.now();
                        newItem.quantity = 1;
                        newItem.equipped = false;
                        items.push(newItem);
                    }
                    saveToStorage();
                    renderInventory(currentInvTab);
                    showNotification(`RECEIVED P2P ITEM: ${data.item.name}`);
                } 
                else if (data.action === 'SHARE_QUEST') {
                    // Check if already got it
                    if (quests.find(q => q.name === data.quest.name)) {
                        showNotification("QUEST LOG ALREADY CONTAINS THIS ENTRY.");
                        return;
                    }
                    
                    const newQuest = {...data.quest};
                    newQuest.id = Date.now();
                    quests.push(newQuest);
                    saveToStorage();
                    if (currentDataTab === 'quests') renderQuests();
                    showNotification(`NEW QUEST UPLOADED: ${newQuest.name}`);
                }
                else {
                    showNotification("UNRECOGNIZED P2P DATA PROTOCOL.");
                }

            } catch(e) {
                showNotification("DATA CORRUPTION ERROR. P2P TRANSFER FAILED.");
            }
        }

        function generateQR(payloadStr) {
            document.getElementById('qr-code-canvas').innerHTML = ''; // clear old
            new QRCode(document.getElementById("qr-code-canvas"), {
                text: payloadStr,
                width: 250,
                height: 250,
                colorDark : "#051005",
                colorLight : "#1aff80", // Using pipboy colors for the code!
                correctLevel : QRCode.CorrectLevel.L
            });
            document.getElementById('qr-display-modal').style.display = 'flex';
        }

        let pendingRefundItem = null;

        function closeQRDisplay(wasSuccessful) {
            document.getElementById('qr-display-modal').style.display = 'none';
            if (!wasSuccessful && pendingRefundItem) {
                // User aborted the trade, refund the item
                const existing = items.find(i => i.name === pendingRefundItem.name && i.type === pendingRefundItem.type);
                if (existing) {
                    existing.quantity += 1;
                } else {
                    const newItem = {...pendingRefundItem};
                    newItem.id = Date.now();
                    newItem.quantity = 1;
                    newItem.equipped = false;
                    items.push(newItem);
                }
                saveToStorage();
                renderInventory(currentInvTab);
                showNotification("TRADE ABORTED. ITEM REFUNDED.");
            }
            pendingRefundItem = null;
        }

        function generateItemQR() {
            if (!activeItemId) return;
            const item = items.find(i => i.id === activeItemId);
            if (!item) return;

            showCustomPrompt(`TRADING ITEM: ${item.name}. YOU WILL LOSE 1 QUANTITY FROM YOUR INVENTORY. PROCEED?`, [
                {
                    label: "GENERATE CODE",
                    action: () => {
                        pendingRefundItem = { name: item.name, type: item.type, effects: item.effects };
                        modifyItem(-1); // Takes it from their inventory
                        const payload = {
                            action: 'TRADE_ITEM',
                            item: { name: item.name, type: item.type, effects: item.effects }
                        };
                        generateQR(JSON.stringify(payload));
                    }
                },
                { label: "CANCEL", color: "var(--pip-color-dim)", action: () => {} }
            ]);
        }

        function generateQuestQR() {
            if (!activeQuestId) return;
            const quest = quests.find(q => q.id === activeQuestId);
            if (!quest) return;

            const payload = {
                action: 'SHARE_QUEST',
                quest: { 
                    name: quest.name, 
                    type: quest.type, 
                    giver: quest.giver,
                    location: quest.location,
                    timeStr: quest.timeStr,
                    expireTime: quest.expireTime,
                    objectives: [...quest.objectives],
                    completed: false,
                    expired: false,
                    abandoned: false
                }
            };
            generateQR(JSON.stringify(payload));
        }

        function modifyItem(amount) {
            const i = items.findIndex(x => x.id === activeItemId);
            if (i > -1) { items[i].quantity += amount; if (items[i].quantity <= 0) items.splice(i, 1); closeModals(); saveToStorage(); renderInventory(currentInvTab); }
        }
        function toggleEquip(id) { const i = items.find(x => x.id === id); if (i) { i.equipped = !i.equipped; closeModals(); saveToStorage(); renderInventory(currentInvTab); } }

        function saveNewItem() {
            items.push({ id: Date.now(), name: (document.getElementById('add-name').value || 'ITEM').toUpperCase(), type: document.getElementById('add-type').value, effects: document.getElementById('add-effects').value, quantity: 1, equipped: false });
            saveToStorage(); switchSubTab('inv', document.getElementById('add-type').value); closeModals();
        }

        function saveNewQuest() {
            try {
                let rawObjs = document.getElementById('q-obj').value;
                let objectivesList = rawObjs ? rawObjs.split(',').map(o => o.trim()) : ["No objectives given"];
                
                let timeInputEl = document.getElementById('q-time');
                let timeInput = timeInputEl ? timeInputEl.value.trim() : "";
                
                let expireTimestamp = null;
                let displayTime = '--:--';

                if(timeInput) {
                    let h = NaN, m = NaN;
                    
                    let looksLikeClockTime = timeInput.includes(':') || /^\d{3,4}$/.test(timeInput);

                    if (looksLikeClockTime) {
                        if(timeInput.includes(':')) {
                            let parts = timeInput.split(':');
                            h = parseInt(parts[0], 10);
                            m = parseInt(parts[1], 10);
                        } else {
                            let clean = timeInput.replace(/[^0-9]/g, '');
                            if(clean.length >= 3) {
                                h = parseInt(clean.substring(0, clean.length-2), 10);
                                m = parseInt(clean.substring(clean.length-2), 10);
                            }
                        }
                    }

                    if(!isNaN(h) && !isNaN(m)) {
                        const d = new Date();
                        d.setHours(h, m, 0, 0);
                        if (d < new Date()) d.setDate(d.getDate() + 1);
                        expireTimestamp = d.getTime();
                        displayTime = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
                    } else {
                        displayTime = timeInput; 
                    }
                }

                let newQuest = {
                    id: Date.now(),
                    name: (document.getElementById('q-name').value || 'UNKNOWN QUEST').toUpperCase(),
                    type: qTypeVal,   // v0.55: themed picker state
                    giver: qGiverVal, // v0.55: themed picker state
                    location: (document.getElementById('q-loc').value || 'UNKNOWN').toUpperCase(),
                    timeStr: displayTime,
                    expireTime: expireTimestamp,
                    objectives: objectivesList,
                    completed: false,
                    expired: false
                };
                
                quests.push(newQuest);
                
                saveToStorage(); 
                renderQuests(); 
                closeModals();
            } catch(e) {
                console.error("Quest save error", e);
                showNotification("SYSTEM ERROR SAVING QUEST.");
            }
        }

        // Radio Logic
        let audioPlayer = new Audio();
        audioPlayer.loop = true;

        function playRadio(element, trackUrl) {
            document.querySelectorAll('.radio-station').forEach(st => st.classList.remove('playing'));
            element.classList.add('playing');
            
            audioPlayer.pause();
            if (trackUrl) {
                audioPlayer.src = trackUrl;
                audioPlayer.play().catch(err => {
                    showNotification("RADIO ERROR: BROWSER BLOCKED AUTO-PLAY. TAP ANYWHERE FIRST.");
                });
            }
        }

        // Leaflet Maps Logic (Free API)
        let pipMap = null;
        let markersGroup = null;
        let otherPlayersGroup = null;
        // v0.38: SHARED MAP PINS board -- any wastelander can broadcast a marker to every
        // Pip-Boy on the satellite via the sharedpins/ node (same watch pattern as the
        // wastelanders/ radar). Rendered as dashed diamonds, sender credited in the label,
        // and pins older than 72h are skipped (outlive the weekend, die before the next).
        let sharedPinsGroup = null;
        let lastKnownSharedPins = {};
        let radZonesGroup = null;          // v0.47: Overseer hot zones (static fields)
        let lastKnownRadZones = {};
        let zoneMarkerRefs = {};           // v0.51: zoneKey -> diamond marker, for select-to-reveal labels
        let selectedZoneKey = null;        // v0.51: tapped zone pins the map card + shows its label
        let userMarker = null;
        let gpsWatchId = null;
        let liveTrackingEnabled = false;

        function initPipMap() {
            if (pipMap) {
                pipMap.invalidateSize();
                renderMarkers();
                return;
            }
            
            // v0.55: NO forced homes -- the map reopens on the view YOU left (persisted on
            // every moveend). First-ever open falls back to the waypoint frame / Perth.
            let savedView = null;
            try { savedView = JSON.parse(localStorage.getItem('pipboy-mapview') || 'null'); } catch (e) {}
            const initialCenter = (savedView && savedView.c) ? savedView.c : (waypoints.length > 0 ? [waypoints[0].lat, waypoints[0].lng] : [-31.9505, 115.8605]);
            const initialZoom = (savedView && savedView.z) ? savedView.z : 14;

            pipMap = L.map('map-container', {
                zoomControl: true,
                attributionControl: true
            }).setView(initialCenter, initialZoom);
            pipMap.on('moveend', () => { // remember the commander's last gaze
                try { localStorage.setItem('pipboy-mapview', JSON.stringify({ c: [pipMap.getCenter().lat, pipMap.getCenter().lng], z: pipMap.getZoom() })); } catch (e) {}
            });

            // Using CartoDB Dark Matter (Free, no API key needed) and styling it with CSS filters
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO',
                maxZoom: 19
            }).addTo(pipMap);
            
            // Listen for long-press / right-click
            pipMap.on('contextmenu', function(e) {
                openAddWaypointModal(e.latlng.lat, e.latlng.lng);
            });

            // Tapping empty map clears the sticky selection (beacon OR zone, v0.51)
            pipMap.on('click', function() { if (selectedBeaconUid || selectedZoneKey || selectedPinKey) deselectBeacon(); });

            markersGroup = L.layerGroup().addTo(pipMap);
            otherPlayersGroup = L.layerGroup().addTo(pipMap);
            sharedPinsGroup = L.layerGroup().addTo(pipMap); // v0.38 broadcast marker board
            radZonesGroup = L.layerGroup().addTo(pipMap);   // v0.47 Overseer hot zones
            renderMarkers();
            // v0.63: ALWAYS show user marker on map open if we have coordinates
            // Live (solid) if GPS enabled, cold (dashed) if disabled but we have last known
            if (myLastLat !== null && myLastLng !== null && !userMarker) {
                const isLive = gpsWatchId !== null;
                ensureUserMarker(myLastLat, myLastLng, !isLive);
            }
            // v0.53 ZONE FIX (user: "zones disappeared from the map but still in the remove
            // list"): radzones/ fires at comms boot, mapless, so its first emission was
            // guard-swallowed and nothing EVER re-rendered zones on map open -- they only
            // appeared after a live drop/extinguish. Repaint from the stored mirror now.
            renderRadZones(lastKnownRadZones);
            
            // Start listening to Firebase for other players
            if (window.db) {
                const usersRef = window.firebaseRef(window.db, 'wastelanders/');
                window.firebaseOnValue(usersRef, (snapshot) => {
                    otherPlayersGroup.clearLayers();
                    const data = snapshot.val();
                    lastKnownBeaconData = data || {}; // sticky-select card + rolodex presence read from this
                    const myUid = localStorage.getItem('pipboy-uid');
                    let liveN = 0, drawnN = 0; // v0.56: SIGNALS census

                    const otherPlayerIcon = L.divIcon({
                        className: 'custom-pip-marker',
                        html: `<div style="background-color: transparent; width: 14px; height: 14px; border-radius: 50%; border: 2px dashed #ffb642; box-shadow: 0 0 10px #ffb642;"></div>`,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7]
                    });
                    // v0.56: cold dots ghost instead of impersonating live ones (stale intel FADES)
                    const otherPlayerIconCold = L.divIcon({
                        className: 'custom-pip-marker',
                        html: `<div style="background-color: transparent; width: 14px; height: 14px; border-radius: 50%; border: 2px dashed var(--pip-color-dim); opacity: 0.6;"></div>`,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7]
                    });

                    if (data) for (let uid in data) {
                        if (uid === myUid) continue; // Don't draw ourselves twice

                        const p = data[uid];
                        if (!p) continue;

                        // Skip any beacon older than 24 hours (keeps the radar map clean)
                        if (!p.timestamp || (Date.now() - p.timestamp) > 24 * 60 * 60 * 1000) continue;

                        // v0.56: one rotten beacon record could throw mid-loop and black out EVERY
                        // dot on this unit (roster/zones kept rendering) -- guard per-beacon
                        const plat = (typeof p.lat === 'number') ? p.lat : parseFloat(p.lat);
                        const plng = (typeof p.lng === 'number') ? p.lng : parseFloat(p.lng);
                        if (!isFinite(plat) || !isFinite(plng)) continue;

                        // Calculate how old this data is
                        const ageInMinutes = Math.floor((Date.now() - p.timestamp) / 60000);
                        let nameLabel = String(p.name || 'WASTELANDER');

                        // If the data is older than 5 minutes, mark them as 'Last Known Location'
                        if (ageInMinutes > 5) {
                            nameLabel += ` (LKL: ${ageInMinutes}m ago)`;
                        } else liveN++;
                        drawnN++;

                        try {
                            const pMarker = L.marker([plat, plng], {icon: ageInMinutes > 5 ? otherPlayerIconCold : otherPlayerIcon, zIndexOffset: 900})
                                .bindTooltip(nameLabel, {
                                    permanent: false,
                                    direction: 'top',
                                    className: 'pip-tooltip'
                                })
                                .addTo(otherPlayersGroup);
                            // v0.31 sticky-select: tap a beacon to pin their info card
                            pMarker.on('click', (e) => {
                                L.DomEvent.stopPropagation(e.originalEvent);
                                selectBeacon(uid);
                            });
                        } catch (e) { drawnN--; }
                    }
                    updateSignalsChip(liveN, drawnN - liveN); // v0.56: the empty-map question now has a number
                    // Live-refresh the pinned card as beacons stream in
                    if (selectedBeaconUid) updateMapUserCard();
                    updateHud(); // v0.56
                    renderWastelandersListMap(); // v0.63: update scrollable wastelanders list below map
                });

                // v0.38: watch the shared pins board (read is open to everyone per rules)
                const pinsRef = window.firebaseRef(window.db, 'sharedpins/');
                window.firebaseOnValue(pinsRef, (snap) => { renderSharedPins(snap.val() || {}); }, () => {});
            }
            // v0.63: render wastelanders list on map open (even if no beacon data yet)
            renderWastelandersListMap();
        }

        // v0.56: the live signal census chip on the map edge
        function updateSignalsChip(live, cold) {
            const el = document.getElementById('map-signals');
            if (!el) return;
            el.innerText = 'SIGNALS: ' + live + ' LIVE' + (cold ? ' · ' + cold + ' COLD' : '');
        }

        // v0.38: draw every broadcast marker from every wastelander (72h staleness prune)
        let pinMarkerRefs = {}; // v0.56
        function renderSharedPins(data) {
            lastKnownSharedPins = data || {};
            if (!sharedPinsGroup) return;
            sharedPinsGroup.clearLayers();
            pinMarkerRefs = {};
            const now = Date.now();
            const sharedIcon = L.divIcon({
                className: 'custom-pip-marker',
                html: '<div style="width: 12px; height: 12px; transform: rotate(45deg); border: 2px dashed var(--pip-color); background: transparent; box-shadow: 0 0 10px var(--pip-color-dim);"></div>',
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });
            Object.keys(lastKnownSharedPins).forEach(key => {
                const p = lastKnownSharedPins[key];
                if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
                if (p.from && myMailUid && p.from === myMailUid) return; // v0.46: self-echo filter — your LOCAL marker already is your view of your broadcast; the diamond is for everyone else
                // v0.63: only prune non-permanent pins (overseer-broadcast pins have permanent:true)
                if (!p.permanent && (!p.ts || (now - p.ts) > 72 * 60 * 60 * 1000)) return; // stale: skip
                const who = p.fromName ? (' — VIA ' + String(p.fromName).toUpperCase()) : '';
                const pm = L.marker([p.lat, p.lng], {icon: sharedIcon, zIndexOffset: 500})
                    .bindTooltip(String(p.label || 'SHARED MARKER').toUpperCase() + who, {
                        permanent: false, // v0.56: labels reveal on tap only (user)
                        direction: 'bottom',
                        className: 'pip-tooltip'
                    })
                    .addTo(sharedPinsGroup);
                pm.on('click', (e) => { L.DomEvent.stopPropagation(e.originalEvent); selectSharedPin(key); });
                pinMarkerRefs[key] = pm;
                if (key === selectedPinKey) pm.openTooltip(); // keep the label up across board refreshes
            });
            if (selectedPinKey) updatePinCard(); // auto-deselects if the pin vanished under it
        }

        // v0.50: draw every Overseer ZONE — real-radius L.circle fence (scales with zoom,
        // matches ground truth 15m) + center glyph. HOT = red dashed ☢, MED = soft green ✚.
        // Permanent until EXTINGUISHED (no staleness prune: the Overseer owns the board)
        function renderRadZones(data) {
            lastKnownRadZones = data || {};
            if (!radZonesGroup) return;
            radZonesGroup.clearLayers();
            Object.keys(lastKnownRadZones).forEach(zk => {
                const z = lastKnownRadZones[zk];
                if (!z || typeof z.lat !== 'number' || typeof z.lng !== 'number') return;
                // v0.58: decon kind added — cyan/teal with ✦ glyph
                const kind = z.kind || 'hot';
                const color = kind === 'med' ? '#5fc98e' : (kind === 'decon' ? '#42d4f5' : '#ff3333');
                const glyph = kind === 'med' ? '✚' : (kind === 'decon' ? '✦' : '☢');
                const defaultLabel = kind === 'med' ? 'MED ZONE' : (kind === 'decon' ? 'DECON STATION' : 'HOT ZONE');
                L.circle([z.lat, z.lng], {
                    radius: (typeof z.radius === 'number' ? z.radius : 15),
                    color: color, weight: 1.5, dashArray: '6 4',
                    fillColor: color, fillOpacity: 0.07
                }).addTo(radZonesGroup);
                // v0.51 (user: "labels not live -- only if selected, keep the zones up"):
                // the fence stays drawn always, but the label tooltip is no longer
                // permanent -- it appears only while the zone is SELECTED. The full
                // fence ring is the tap target (comfortable on phones), the diamond too.
                const fence = L.circle([z.lat, z.lng], {
                    radius: (typeof z.radius === 'number' ? z.radius : 15),
                    color: color, weight: 1.5, dashArray: '6 4',
                    fillColor: color, fillOpacity: 0.07
                }).addTo(radZonesGroup);
                fence.on('click', (e) => { L.DomEvent.stopPropagation(e.originalEvent); selectZone(zk); });
                const zoneIcon = L.divIcon({
                    className: 'custom-pip-marker',
                    html: '<div style="width: 14px; height: 14px; transform: rotate(45deg); border: 2px dashed ' + color + '; background: transparent; box-shadow: 0 0 12px ' + color + ';"></div>',
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                });
                const zm = L.marker([z.lat, z.lng], {icon: zoneIcon, zIndexOffset: 450})
                    .bindTooltip(glyph + ' ' + String(z.label || defaultLabel).toUpperCase(), {
                        permanent: false,
                        direction: 'bottom',
                        className: 'pip-tooltip'
                    })
                    .addTo(radZonesGroup);
                zm.on('click', (e) => { L.DomEvent.stopPropagation(e.originalEvent); selectZone(zk); });
                zoneMarkerRefs[zk] = zm;
                if (zk === selectedZoneKey) zm.openTooltip(); // keep the label up across radzones/ refreshes
            });
            // v0.51: the selected zone was extinguished under us -> drop the card
            if (selectedZoneKey && !zoneMarkerRefs[selectedZoneKey]) deselectZone();
            else if (selectedZoneKey) updateZoneCard();
        }

        // v0.63: render scrollable list of live wastelanders below map
        function renderWastelandersListMap() {
            const liveEl = document.getElementById('wastelanders-scroll');
            const coldEl = document.getElementById('cold-wastelanders-scroll');
            if (!liveEl || !coldEl) return;
            const now = Date.now();
            const myUid = localStorage.getItem('pipboy-uid');
            const live = [];
            const cold = [];
            Object.keys(lastKnownBeaconData || {}).forEach(uid => {
                if (uid === myUid) return; // skip self
                const b = lastKnownBeaconData[uid];
                if (!b || !b.timestamp) return;
                const ageMin = Math.floor((now - b.timestamp) / 60000);
                const dist = (myLastLat !== null && typeof b.lat === 'number') ? getDistance(myLastLat, myLastLng, b.lat, b.lng) : null;
                const entry = { uid, name: b.name || 'UNKNOWN', lat: b.lat, lng: b.lng, ageMin, dist };
                if (ageMin <= 5) {
                    live.push(entry);
                } else {
                    cold.push(entry);
                }
            });
            // Sort live by distance (closest first), cold by age (most recent first)
            const sortByDist = (a, b) => {
                if (a.dist === null && b.dist === null) return 0;
                if (a.dist === null) return 1;
                if (b.dist === null) return -1;
                return a.dist - b.dist;
            };
            const sortByAge = (a, b) => {
                // Most recent first (smallest ageMin first)
                return a.ageMin - b.ageMin;
            };
            live.sort(sortByDist);
            cold.sort(sortByAge);
            
            // Render live wastelanders
            if (!live.length) {
                liveEl.innerHTML = '<p style="opacity: 0.5; font-size: 0.85rem;">No live signals</p>';
            } else {
                liveEl.innerHTML = live.map(w => {
                    const distStr = w.dist !== null ? (w.dist < 1000 ? Math.round(w.dist) + 'm' : (w.dist / 1000).toFixed(1) + 'km') : '—';
                    return `<div style="padding: 6px 0; border-bottom: 1px dashed var(--pip-color-dim); cursor: pointer;" onclick="mapGoToWastelander('${w.uid}', ${w.lat}, ${w.lng})">
                        <div style="font-weight: bold;">${escapeHtml(w.name)}</div>
                        <div style="font-size: 0.8rem; opacity: 0.7;">${distStr} · LKL ${w.ageMin}m ago</div>
                    </div>`;
                }).join('');
            }
            
            // Render cold wastelanders
            if (!cold.length) {
                coldEl.innerHTML = '<p style="opacity: 0.5; font-size: 0.8rem;">No cold signals</p>';
            } else {
                coldEl.innerHTML = cold.map(w => {
                    const distStr = w.dist !== null ? (w.dist < 1000 ? Math.round(w.dist) + 'm' : (w.dist / 1000).toFixed(1) + 'km') : '—';
                    const ageStr = w.ageMin < 60 ? w.ageMin + 'm ago' : Math.floor(w.ageMin / 60) + 'h ago';
                    return `<div style="padding: 5px 0; border-bottom: 1px dashed var(--pip-color-dim); cursor: pointer;" onclick="mapGoToWastelander('${w.uid}', ${w.lat}, ${w.lng})">
                        <div style="font-weight: bold;">${escapeHtml(w.name)}</div>
                        <div style="font-size: 0.75rem; opacity: 0.6;">${distStr} · ${ageStr}</div>
                    </div>`;
                }).join('');
            }
        }

        // v0.63: center map on a wastelander from the list
        function mapGoToWastelander(uid, lat, lng) {
            if (!pipMap || typeof lat !== 'number' || typeof lng !== 'number') return;
            pipMap.setView([lat, lng], Math.max(pipMap.getZoom(), 16));
            selectBeacon(uid);
        }

        function renderMarkers() {
            if (!pipMap || !markersGroup) return;
            markersGroup.clearLayers();

            const customIcon = L.divIcon({
                className: 'custom-pip-marker',
                html: `<div style="background-color: var(--pip-color); width: 12px; height: 12px; transform: rotate(45deg); border: 2px solid var(--pip-bg); box-shadow: 0 0 10px var(--pip-color);"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });

            waypoints.forEach(wp => {
                const marker = L.marker([wp.lat, wp.lng], {icon: customIcon})
                    .bindTooltip(wp.name, {
                        permanent: false, // v0.56: labels reveal on tap only (user)
                        direction: 'top', 
                        className: 'pip-tooltip'
                    })
                    .addTo(markersGroup);
            });
            
            // v0.55: waypoint re-renders no longer re-frame the camera. Explicit camera
            // orders live in mapGoMe()/mapFitAll() below, wired to the MAP tab buttons.
        }

        // v0.55: explicit camera commands (were autopilot yanks before).
        function mapGoMe() {
            if (!pipMap) return;
            if (myLastLat === null || myLastLng === null) { showNotification('NO POSITION FIX -- ENABLE GPS TRACKING.'); return; }
            // v0.63: refresh dot state when centering (toggle to ensure marker updates)
            if (userMarker) {
                markersGroup.removeLayer(userMarker);
                userMarker = null;
            }
            const isLive = gpsWatchId !== null;
            ensureUserMarker(myLastLat, myLastLng, !isLive);
            pipMap.setView([myLastLat, myLastLng], Math.max(pipMap.getZoom(), 16));
        }
        function mapFitAll() {
            if (!pipMap) return;
            const pts = [];
            waypoints.forEach(wp => pts.push([wp.lat, wp.lng]));
            Object.keys(lastKnownSharedPins || {}).forEach(k => { const p = lastKnownSharedPins[k]; if (p && typeof p.lat === 'number' && typeof p.lng === 'number') pts.push([p.lat, p.lng]); });
            if (myLastLat !== null && myLastLng !== null) pts.push([myLastLat, myLastLng]);
            if (!pts.length) { showNotification('NOTHING TO FRAME YET.'); return; }
            pipMap.fitBounds(L.latLngBounds(pts).pad(0.25));
        }

        function saveNewWaypoint() {
            const name = document.getElementById('wp-name').value.trim() || 'UNKNOWN LOCATION';
            
            if (tempWpLat === null || tempWpLng === null) return;

            const wp = {
                id: Date.now(),
                name: name.toUpperCase(),
                lat: tempWpLat,
                lng: tempWpLng,
                discovered: false // By default, user-created waypoints can also be "discovered"
            };
            waypoints.push(wp);

            saveToStorage();
            if (document.getElementById('tab-map').classList.contains('active')) {
                renderMarkers();
            }
            closeModals();
            // v0.38: offer to sync the new marker out to every other Pip-Boy (opt-in per
            // marker -- silent auto-broadcast of every scribble would flood the board)
            // v0.63: overseers can mark broadcasts as permanent (no 72h prune)
            const isOverseer = localStorage.getItem('pipboy-dev-mode') === 'true';
            showCustomPrompt('MARKER SAVED. BROADCAST "' + wp.name + '" TO ALL WASTELANDERS?', [
                { label: 'SHARE WITH EVERYONE' + (isOverseer ? ' (PERMANENT)' : ''), action: () => broadcastWaypoint(wp, isOverseer) },
                { label: 'KEEP PRIVATE', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        // v0.38: push one marker onto the sharedpins/ board for every client to draw
        function broadcastWaypoint(wp, permanent) {
            if (!window.db || navigator.onLine === false) { showNotification('NO SIGNAL -- MARKER STAYS LOCAL.'); return; }
            const key = 'p' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
            const pin = {
                label: String(wp.name || 'MARKER').toUpperCase().substring(0, 32),
                lat: wp.lat,
                lng: wp.lng,
                from: myMailUid || 'ANON',
                fromName: String(userProfile.name || 'UNKNOWN').toUpperCase().substring(0, 32),
                ts: Date.now(),
                permanent: !!permanent // v0.63: overseer-broadcast pins persist indefinitely
            };
            window.firebaseSet(window.firebaseRef(window.db, 'sharedpins/' + key), pin)
                .then(() => showNotification(permanent ? 'MARKER BROADCAST TO ALL WASTELANDERS (PERMANENT).' : 'MARKER BROADCAST TO ALL WASTELANDERS.'))
                .catch(() => showNotification('BROADCAST FAILED -- MARKER STAYS LOCAL.'));
        }

        // v0.55: takes the id directly now (themed picker), the select is gone
        function deleteWaypointById(idToRemove) {
            waypoints = waypoints.filter(wp => wp.id !== idToRemove);
            saveToStorage();
            if (document.getElementById('tab-map').classList.contains('active')) {
                renderMarkers();
            }
            closeModals();
        }

        // Geofencing helper function (Haversine formula to get distance in meters)
        function getDistance(lat1, lon1, lat2, lon2) {
            const R = 6371e3; // Earth radius in meters
            const φ1 = lat1 * Math.PI/180;
            const φ2 = lat2 * Math.PI/180;
            const Δφ = (lat2-lat1) * Math.PI/180;
            const Δλ = (lon2-lon1) * Math.PI/180;
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c; 
        }

        // ================= GPS ENGINE (v0.52 REBUILD) =================
        // On-until-turned-off + resilient. Previously ONE transient satellite timeout
        // tore the whole session down (user-reported: "my dot disappears quickly"): the
        // error handler called toggleGPS(), which cleared the watch AND wiped the
        // Firebase beacon -- while the rad engine kept running on the last fix. Now only
        // a MANUAL tap or a revoked permission stops tracking; timeouts keep the watch,
        // the dot, the beacon and the last fix alive. Screen-off geiger ticks preserved.
        let lastFixAt = 0;            // last fresh satellite fix
        let lastBeaconAt = 0;         // last wastelanders/ write (fix or keepalive stamp)
        let gpsRestoredPending = false; // auto-armed at boot; toast once on first fix

        function toggleGPS() {
            if (gpsWatchId !== null) {
                // The ONLY manual off-switch: an explicit tap.
                stopGpsWatch('manual');
                return;
            }
            if (localStorage.getItem('pipboy-opt-in') !== 'true') {
                showNotification("GPS TRACKING ABORTED. YOU MUST OPT-IN TO SATELLITE TRACKING TO ENABLE THIS FEATURE.");
                return;
            }
            if (!navigator.geolocation) {
                showNotification("GEOLOCATION IS NOT SUPPORTED BY YOUR DEVICE.");
                return;
            }
            localStorage.setItem('pipboy-gps-tracking', '1'); // v0.52: on until turned off
            startGpsWatch();
        }

        function stopGpsWatch(reason) {
            if (gpsWatchId !== null) {
                navigator.geolocation.clearWatch(gpsWatchId);
                gpsWatchId = null;
            }
            localStorage.setItem('pipboy-gps-tracking', '0');
            updateHud(); // v0.56
            const btn = document.getElementById('gps-btn');
            if (btn) {
                btn.innerText = "[ENABLE GPS TRACKING]";
                btn.style.background = "transparent";
                btn.style.color = "var(--pip-color)";
            }
            // v0.56: GPS OFF no longer erases your dot -- it drops to a ghost at the last fix
            if (myLastLat !== null && myLastLng !== null && markersGroup) {
                ensureUserMarker(myLastLat, myLastLng, true);
            } else if (userMarker && markersGroup) {
                markersGroup.removeLayer(userMarker);
                userMarker = null;
            }
            const myUid = localStorage.getItem('pipboy-uid');
            if (myUid) {
                if (selectedBeaconUid === myUid) deselectBeacon();
                // Wipe our tracking data from Firebase so we disappear from other maps
                if (window.db) window.firebaseSet(window.firebaseRef(window.db, 'wastelanders/' + myUid), null);
            }
            // Deliberately KEPT: myLastLat/myLastLng -- the rad engine keeps evaluating
            // your last known position even after the link dies.
        }

        function startGpsWatch() {
            if (gpsWatchId !== null || !navigator.geolocation) return;
            let myUid = localStorage.getItem('pipboy-uid');
            if (!myUid) {
                myUid = 'user_' + Date.now() + Math.floor(Math.random()*1000);
                localStorage.setItem('pipboy-uid', myUid);
            }
            const btn = document.getElementById('gps-btn');
            if (btn) btn.innerText = "[LOCATING SATELLITE...]";
            lastFixAt = Date.now();
            gpsWatchId = navigator.geolocation.watchPosition(
                gpsOnFix,
                gpsOnError,
                // v0.52: breathing room -- the old 10000/5000 settings invited the kill
                { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
            );
        }

        // v0.52: silent re-arm after app restarts (location permission persists on the
        // device; no fullscreen grab -- just the watch). Booted after initComms below.
        function maybeAutoGps() {
            if (gpsWatchId !== null) return;
            if (localStorage.getItem('pipboy-gps-tracking') !== '1') return;
            if (localStorage.getItem('pipboy-opt-in') !== 'true') return;
            if (!navigator.geolocation) return;
            gpsRestoredPending = true;
            startGpsWatch();
        }

        function gpsOnFix(position) {
            // The GPS permission popup force-exited fullscreen; try to slide back in
            restoreFullscreenIfDesired();
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            // v0.57: track distance travelled (haversine delta from previous fix)
            if (myLastLat !== null && myLastLng !== null) {
                const d = getDistance(myLastLat, myLastLng, lat, lng);
                if (d > 1 && d < 500) { funStats.distance += d; saveFunStats(); } // ignore jumps >500m (GPS glitch)
            }
            myLastLat = lat; myLastLng = lng; // feeds map wastelander-card distance readout
            lastFixAt = Date.now();
            try { localStorage.setItem('pipboy-lastfix', JSON.stringify({ lat: lat, lng: lng, ts: lastFixAt })); } catch (e) {} // v0.56: self-dot survives restarts
            evalPariahField(); // field entry/exit on every fresh fix (ticks backstop)

            const btn = document.getElementById('gps-btn');
            if (btn) {
                btn.innerText = "[DISABLE GPS TRACKING]";
                btn.style.background = "var(--pip-color-dim)";
                btn.style.color = "var(--pip-bg)";
            }
            if (gpsRestoredPending) gpsRestoredPending = false; // v0.56: the sat glyph tells it -- no toast

            if (markersGroup) ensureUserMarker(lat, lng);
            updateHud(); // v0.56

            // Push live location to Firebase (scrambler may swap in the decoy site)
            pushMyBeacon(lat, lng);

            // --- GEOFENCING LOGIC (DISCOVER WAYPOINTS) ---
            let changed = false;
            waypoints.forEach(wp => {
                if (!wp.discovered) {
                    const dist = getDistance(lat, lng, wp.lat, wp.lng);
                    if (dist < 30) {
                        wp.discovered = true;
                        changed = true;
                        showNotification("LOCATION DISCOVERED: " + wp.name);
                    }
                }
            });
            if (changed) {
                saveToStorage();
                renderStatsTab();
            }
        }

        function gpsOnError(error) {
            restoreFullscreenIfDesired();
            // PERMISSION_DENIED is the only fatal error: the user revoked location access.
            if (error && error.code === 1) {
                stopGpsWatch('denied');
                showNotification("LOCATION PERMISSION DENIED -- GPS TRACKING DISABLED.");
            }
            // POSITION_UNAVAILABLE (2) / TIMEOUT (3): transient. Watch, dot, beacon and
            // last fix all stay alive; housekeeping keeps the beacon freshly stamped.
        }

        // v0.39 marker behaviour preserved (plain pip dot, z 800 under other beacons,
        // clickable self-card). Extracted so the MAP tab can restore the dot late when
        // the watch was auto-armed before the map ever initialised.
        let userMarkerCold = false; // v0.56: ghost state of the self-dot
        function ensureUserMarker(lat, lng, cold) {
            if (!markersGroup) return;
            if (userMarker && userMarkerCold !== !!cold) { markersGroup.removeLayer(userMarker); userMarker = null; } // restyle on state flip
            userMarkerCold = !!cold;
            if (!userMarker) {
                const selfStyle = userMarkerCold
                    ? 'background-color: transparent; width: 14px; height: 14px; border-radius: 50%; border: 2px dashed var(--pip-color-dim);'
                    : 'background-color: var(--pip-color); width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--pip-bg); box-shadow: 0 0 10px var(--pip-color);';
                const userIcon = L.divIcon({
                    className: 'custom-pip-marker',
                    html: `<div style="${selfStyle}"></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                });
                userMarker = L.marker([lat, lng], {icon: userIcon, zIndexOffset: 800})
                    .addTo(markersGroup);
                userMarker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e.originalEvent);
                    selectBeacon(localStorage.getItem('pipboy-uid'));
                });
                // v0.55: the dot draws, the camera STAYS -- no more forced zoom-to-face
            } else {
                userMarker.setLatLng([lat, lng]);
            }
        }

        // Single beacon writer for fresh fixes AND keepalive stamps. v0.51 telemetry
        // (hp/rads optional numerics) always rides; v0.52 scrambler may substitute the
        // decoy site for the coordinates other units receive.
        function pushMyBeacon(lat, lng) {
            if (!window.db) return;
            const myUid = localStorage.getItem('pipboy-uid');
            if (!myUid) return;
            let blat = lat, blng = lng;
            if (scramblerOn()) {
                const d = decoyCoords();
                blat = d.lat;
                blng = d.lng;
            }
            const myRads = userProfile.rads || 0;
            window.firebaseSet(window.firebaseRef(window.db, 'wastelanders/' + myUid), {
                name: (userProfile.name || 'UNKNOWN').slice(0, 24), // rules cap name at 24 chars
                lat: blat,
                lng: blng,
                timestamp: Date.now(),
                hp: Math.max(0, userProfile.maxHp - Math.floor((myRads / 1000) * userProfile.maxHp)),
                rads: myRads,
                mutations: activeMutations.length, // v0.58: broadcast mutation count for beacon indicator
                glowingOne: isGlowingOne // v0.67: broadcast Glowing One status
            });
            lastBeaconAt = Date.now();
        }

        // Health + keepalive, every 15s: a beacon older than ~5min renders LKL (and stops
        // irradiating its owner's pariah pursuers), so re-stamp every 30s even standing
        // stock-still. 90s without any fix earns a quiet UNSTABLE label, never a kill.
        setInterval(() => {
            if (gpsWatchId === null) return;
            const now = Date.now();
            if (myLastLat !== null && myLastLng !== null && (now - lastBeaconAt) >= 30000) {
                pushMyBeacon(myLastLat, myLastLng);
            }
            if (now - lastFixAt > 90000) {
                const btn = document.getElementById('gps-btn');
                if (btn && btn.innerText.indexOf('UNSTABLE') === -1) btn.innerText = "[GPS UNSTABLE -- HOLDING LAST FIX]";
            }
            updateHud(); // v0.56: keeps the sat glyph honest between fixes
        }, 15000);

        // v0.56: your last fix persists -- your dot is ALWAYS on the map (user: "always")
        function loadLastFix() { try { return JSON.parse(localStorage.getItem('pipboy-lastfix') || 'null'); } catch (e) { return null; } }
        function hydrateLastFix() {
            if (myLastLat !== null) return;
            const lf = loadLastFix();
            if (lf && typeof lf.lat === 'number' && typeof lf.lng === 'number') {
                myLastLat = lf.lat; myLastLng = lf.lng; lastFixAt = lf.ts || 0;
            }
        }

        // ================= BEACON SCRAMBLER (v0.52) =================
        // Privacy decoy for pre-event testing: YOUR unit keeps its real fix (rads, zones,
        // healing, distances stay truthful) -- only what other Pip-Boys receive is faked.
        const DEFAULT_DECOY = { lat: -31.56346462162551, lng: 117.7976226150244 }; // event site (user-supplied)
        function decoyBase() {
            try {
                const raw = JSON.parse(localStorage.getItem('pipboy-decoy') || 'null');
                if (raw && typeof raw.lat === 'number' && typeof raw.lng === 'number') return raw;
            } catch (e) {}
            return DEFAULT_DECOY;
        }
        function scramblerOn() { 
            // v0.71: default to ON (scrambled) for privacy
            const val = localStorage.getItem('pipboy-scrambler');
            return val === null || val === '1'; 
        }
        function decoyCoords() {
            // Stable per-unit scatter seeded from the UID: N scrambled testers never share
            // one pixel, every client renders the identical layout, dots never wander.
            const base = decoyBase();
            const uid = localStorage.getItem('pipboy-uid') || 'anon';
            let h = 0;
            for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
            const ang = (Math.abs(h) % 360) * Math.PI / 180;
            const r = 5 + (Math.abs(h >> 8) % 4) * 5; // 5..20 m
            return {
                lat: base.lat + (r * Math.cos(ang)) / 111320,
                lng: base.lng + (r * Math.sin(ang)) / (111320 * Math.cos(base.lat * Math.PI / 180))
            };
        }
        function toggleScrambler() {
            const on = !scramblerOn();
            localStorage.setItem('pipboy-scrambler', on ? '1' : '0');
            syncScramblerBtn();
            showNotification(on
                ? "BEACON SCRAMBLER ON -- OTHER UNITS SEE YOUR DOT AT THE DECOY SITE. LONG-PRESS THE MAP > SET DECOY SITE TO MOVE IT."
                : "BEACON SCRAMBLER OFF -- BROADCASTING YOUR REAL POSITION AGAIN.");
            // Re-stamp the beacon immediately with the new truth
            if (gpsWatchId !== null && myLastLat !== null && myLastLng !== null) pushMyBeacon(myLastLat, myLastLng);
            updateMapUserCard(); // refreshes the SCRAMBLED tell if your own card is pinned
        }
        function syncScramblerBtn() {
            const b = document.getElementById('options-scrambler-btn');
            if (b) b.innerText = scramblerOn() ? '[BEACON SCRAMBLER: ON]' : '[BEACON SCRAMBLER: OFF]';
        }
        (function() { syncScramblerBtn(); })();
        // Long-press map > [SET DECOY SITE HERE] (tempWp* are locked by the waypoint modal)
        function setDecoySite() {
            if (typeof tempWpLat !== 'number' || typeof tempWpLng !== 'number') return;
            localStorage.setItem('pipboy-decoy', JSON.stringify({ lat: tempWpLat, lng: tempWpLng }));
            closeModals();
            showNotification(scramblerOn()
                ? "DECOY SITE SET -- SCRAMBLED DOT MOVED."
                : "DECOY SITE SAVED -- ARM THE SCRAMBLER FROM DATA > OPTIONS TO USE IT.");
            if (scramblerOn() && gpsWatchId !== null && myLastLat !== null && myLastLng !== null) pushMyBeacon(myLastLat, myLastLng);
        }

        // v0.58: OVERSEER tab — all Overseer controls except radio (dev-mode only)
        function renderOverseerTab() {
            const pariahEl = document.getElementById('overseer-pariahs');
            if (!pariahEl) return;
            if (localStorage.getItem('pipboy-dev-mode') !== 'true') {
                pariahEl.style.display = 'none';
                pariahEl.innerHTML = '';
                return;
            }
            pariahEl.style.display = 'block';
            pariahEl.innerHTML = renderPariahPanel() + renderOverseerUserManagement() + renderOverseerGlowingOnes();
        }

        // v0.63: overseer user management — view ALL users who have EVER broadcast, remove dead ones
        function renderOverseerUserManagement() {
            let html = '<h3 style="color:#ffb642; text-shadow:0 0 6px #ffb642; margin-top:20px;">USER MANAGEMENT</h3>';
            html += '<p style="font-size:0.9rem; opacity:0.75; margin-bottom:10px;">ALL USERS WHO HAVE EVER BROADCAST (OVERSEER ONLY)</p>';
            html += '<div id="overseer-users-list" style="max-height:300px; overflow-y:auto; border:1px dashed var(--pip-color-dim); padding:10px;">';
            html += '<p style="opacity:0.5;">Loading...</p>';
            html += '</div>';
            html += '<button class="pip-btn" onclick="loadOverseerUsers()" style="margin-top:10px; border-style:dashed;">[REFRESH USER LIST]</button>';
            html += '<button class="pip-btn" onclick="removeDeadOverseerUsers()" style="margin-top:10px; border-color:#ff3333; color:#ff3333; border-style:dashed;">[REMOVE ALL DEAD USERS]</button>';
            return html;
        }

        // v0.63: load all users from Firebase for overseer management
        function loadOverseerUsers() {
            const el = document.getElementById('overseer-users-list');
            if (!el || !window.db) {
                if (el) el.innerHTML = '<p style="opacity:0.5;">No database connection</p>';
                return;
            }
            el.innerHTML = '<p style="opacity:0.5;">Loading...</p>';
            const usersRef = window.firebaseRef(window.db, 'wastelanders/');
            window.firebaseGet(usersRef).then(snap => {
                const data = snap.val() || {};
                const now = Date.now();
                const staleThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
                const users = Object.keys(data).map(uid => {
                    const u = data[uid];
                    const age = u.timestamp ? (now - u.timestamp) : null;
                    const isDead = age === null || age > staleThreshold;
                    return { uid, name: u.name || 'UNKNOWN', timestamp: u.timestamp, age, isDead };
                }).sort((a, b) => {
                    if (a.isDead && !b.isDead) return 1;
                    if (!a.isDead && b.isDead) return -1;
                    return (a.name || '').localeCompare(b.name || '');
                });
                if (!users.length) {
                    el.innerHTML = '<p style="opacity:0.5;">No users found</p>';
                    return;
                }
                const deadCount = users.filter(u => u.isDead).length;
                let html = '<p style="margin-bottom:10px;">' + users.length + ' total users, ' + deadCount + ' dead (>7 days)</p>';
                users.forEach(u => {
                    const ageStr = u.age !== null ? (u.age < 60000 ? Math.floor(u.age / 1000) + 's ago' : u.age < 3600000 ? Math.floor(u.age / 60000) + 'm ago' : u.age < 86400000 ? Math.floor(u.age / 3600000) + 'h ago' : Math.floor(u.age / 86400000) + 'd ago') : 'never';
                    html += '<div style="padding:6px 0; border-bottom:1px dashed var(--pip-color-dim); opacity:' + (u.isDead ? '0.5' : '1') + ';">';
                    html += '<div style="font-weight:bold;">' + escapeHtml(u.name) + (u.isDead ? ' <span style="color:#ff3333;">[DEAD]</span>' : '') + '</div>';
                    html += '<div style="font-size:0.8rem; opacity:0.7;">UID: ' + u.uid.substring(0, 8) + '... · Last seen: ' + ageStr + '</div>';
                    html += '</div>';
                });
                el.innerHTML = html;
            }).catch(err => {
                el.innerHTML = '<p style="color:#ff3333;">Error loading users: ' + escapeHtml(String(err)) + '</p>';
            });
        }

        // v0.63: remove all dead users (>7 days) from Firebase
        function removeDeadOverseerUsers() {
            if (!window.db) {
                showNotification('No database connection');
                return;
            }
            const staleThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
            const now = Date.now();
            showCustomPrompt('REMOVE ALL DEAD USERS (>7 DAYS) FROM FIREBASE? THIS CANNOT BE UNDONE.', [
                { label: 'REMOVE ALL DEAD', color: '#ff3333', action: () => {
                    const usersRef = window.firebaseRef(window.db, 'wastelanders/');
                    window.firebaseGet(usersRef).then(snap => {
                        const data = snap.val() || {};
                        const deadUids = Object.keys(data).filter(uid => {
                            const u = data[uid];
                            return !u.timestamp || (now - u.timestamp) > staleThreshold;
                        });
                        if (!deadUids.length) {
                            showNotification('No dead users found');
                            return;
                        }
                        let removed = 0;
                        const removeNext = () => {
                            if (removed >= deadUids.length) {
                                showNotification(removed + ' dead users removed from Firebase');
                                loadOverseerUsers(); // refresh the list
                                return;
                            }
                            const uid = deadUids[removed];
                            window.firebaseRemove(window.firebaseRef(window.db, 'wastelanders/' + uid)).then(() => {
                                removed++;
                                removeNext();
                            }).catch(() => {
                                removed++;
                                removeNext();
                            });
                        };
                        removeNext();
                    }).catch(err => {
                        showNotification('Error loading users: ' + String(err));
                    });
                }},
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        // v0.67: overseer Glowing One management — view and cure Glowing Ones
        function renderOverseerGlowingOnes() {
            let html = '<h3 style="color:#39ff14; text-shadow:0 0 6px #39ff14; margin-top:20px;">☢ GLOWING ONES</h3>';
            html += '<p style="font-size:0.9rem; opacity:0.75; margin-bottom:10px;">PLAYERS TRANSFORMED BY RADIATION (OVERSEER CURE ONLY)</p>';
            html += '<div id="overseer-glowing-list" style="max-height:300px; overflow-y:auto; border:1px dashed var(--pip-color-dim); padding:10px;">';
            html += '<p style="opacity:0.5;">Loading...</p>';
            html += '</div>';
            html += '<button class="pip-btn" onclick="loadOverseerGlowingOnes()" style="margin-top:10px; border-style:dashed;">[REFRESH GLOWING ONES]</button>';
            return html;
        }

        // v0.67: load all Glowing Ones from Firebase (including stale beacons)
        function loadOverseerGlowingOnes() {
            const el = document.getElementById('overseer-glowing-list');
            if (!el || !window.db) {
                if (el) el.innerHTML = '<p style="opacity:0.5;">No database connection</p>';
                return;
            }
            el.innerHTML = '<p style="opacity:0.5;">Loading...</p>';
            const usersRef = window.firebaseRef(window.db, 'wastelanders/');
            window.firebaseGet(usersRef).then(snap => {
                const data = snap.val() || {};
                const now = Date.now();
                const glowing = Object.keys(data).filter(uid => {
                    const u = data[uid];
                    return u.glowingOne === true; // show ALL Glowing Ones, even stale
                }).map(uid => {
                    const u = data[uid];
                    const age = u.timestamp ? (now - u.timestamp) : null;
                    const isLive = age !== null && age < 5 * 60 * 1000;
                    return { uid, name: u.name || 'UNKNOWN', rads: u.rads || 0, age, isLive };
                }).sort((a, b) => {
                    // Live first, then by name
                    if (a.isLive && !b.isLive) return -1;
                    if (!a.isLive && b.isLive) return 1;
                    return (a.name || '').localeCompare(b.name || '');
                });
                if (!glowing.length) {
                    el.innerHTML = '<p style="opacity:0.5;">No Glowing Ones found</p>';
                    return;
                }
                const liveCount = glowing.filter(g => g.isLive).length;
                let html = '<p style="margin-bottom:10px;">' + glowing.length + ' Glowing One' + (glowing.length > 1 ? 's' : '') + ' (' + liveCount + ' live)</p>';
                glowing.forEach(g => {
                    const ageStr = g.age !== null ? (g.age < 60000 ? Math.floor(g.age / 1000) + 's ago' : g.age < 3600000 ? Math.floor(g.age / 60000) + 'm ago' : g.age < 86400000 ? Math.floor(g.age / 3600000) + 'h ago' : Math.floor(g.age / 86400000) + 'd ago') : 'never';
                    html += '<div style="padding:6px 0; border-bottom:1px dashed var(--pip-color-dim); opacity:' + (g.isLive ? '1' : '0.6') + ';">';
                    html += '<div style="font-weight:bold; color:#39ff14;">☢ ' + escapeHtml(g.name) + (g.isLive ? '' : ' <span style="color:#ffb642; font-size:0.8rem;">[STALE]</span>') + '</div>';
                    html += '<div style="font-size:0.8rem; opacity:0.7;">Rads: ' + g.rads + ' · Last seen: ' + ageStr + '</div>';
                    html += '<button class="pip-btn" onclick="cureGlowingOne(\'' + g.uid + '\', \'' + escapeHtml(g.name) + '\')" style="margin-top:5px; border-color:#39ff14; color:#39ff14; font-size:0.85rem;">[CURE]</button>';
                    html += '</div>';
                });
                el.innerHTML = html;
            }).catch(err => {
                el.innerHTML = '<p style="color:#ff3333;">Error loading: ' + escapeHtml(String(err)) + '</p>';
            });
        }

        // v0.67: cure a Glowing One (Overseer only)
        function cureGlowingOne(uid, name) {
            if (!window.db) {
                showNotification('No database connection');
                return;
            }
            showCustomPrompt('CURE ' + name + '? THIS WILL RESET THEIR RADIATION AND REMOVE GLOWING ONE STATUS.', [
                { label: 'CURE', color: '#39ff14', action: () => {
                    // Update their beacon to remove glowingOne flag and reset rads
                    const userRef = window.firebaseRef(window.db, 'wastelanders/' + uid);
                    window.firebaseGet(userRef).then(snap => {
                        const data = snap.val();
                        if (!data) {
                            showNotification('User not found');
                            return;
                        }
                        // Update with glowingOne: false and rads: 0
                        window.firebaseSet(userRef, {
                            ...data,
                            glowingOne: false,
                            rads: 0
                        }).then(() => {
                            showNotification(name + ' has been cured');
                            loadOverseerGlowingOnes(); // refresh the list
                        }).catch(err => {
                            showNotification('Error curing: ' + String(err));
                        });
                    }).catch(err => {
                        showNotification('Error loading user: ' + String(err));
                    });
                }},
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        // ================= SHARED VITALS BAR (v0.52) =================
        // The "overtaking" bar: green = HP remaining, red = the rads-eaten slice growing
        // in from the right (1000 rads eats the whole bar). Beacon telemetry for linked
        // contacts; live from userProfile on your own datacard / the footer HUD.
        function vitalsBarHtml(hp, rads) {
            const radPct = Math.max(0, Math.min(100, (rads || 0) / 10));
            const hpPct = Math.max(0, 100 - radPct);
            return '<div style="width:100%; height:9px; border:1px solid var(--pip-color); display:flex; background:var(--pip-bg); margin-top:6px;">' +
                '<div style="height:100%; background-color:var(--pip-color); width:' + hpPct + '%; box-shadow:0 0 5px var(--pip-color);"></div>' +
                '<div style="height:100%; background-color:#ff3333; width:' + radPct + '%; box-shadow:0 0 5px #ff3333;"></div>' +
                '</div><div style="font-size:0.75rem; opacity:0.8; margin-top:2px;">HP ' + hp + ' | <span style="color:#ff3333;">' + (rads || 0) + ' RADS</span></div>';
        }

        function renderStatsTab() {
            // v0.57: stats-general and stats-wild are now static HTML with span IDs;
            // renderFunStats() updates the values live without destroying the DOM
            renderFunStats();
            // v0.58: OVERSEER nav item visibility gated by dev mode (panel moved to its own tab)
            const overseerNav = document.getElementById('overseer-nav-item');
            if (overseerNav) {
                overseerNav.style.display = (localStorage.getItem('pipboy-dev-mode') === 'true') ? '' : 'none';
            }
            // v0.35: roster lives on its own WASTELANDERS tab again; stats just reports
            if (currentDataTab === 'wastelanders') { renderWastelanders(); renderLinkRequests(); }
        }

        function toggleDevMode() {
            let isDev = localStorage.getItem('pipboy-dev-mode') === 'true';
            if (isDev) {
                // v0.48: disabling now needs the PIN — the MAP-tab TOGGLE OVERSEER button is
                // one tap from a fat-finger, and a silent lockout "loses" the whole admin
                // surface (user field report: "lost overseer pariah stuff, not sure how")
                pendingAuthAction = 'TOGGLE_DEV_OFF';
                document.getElementById('auth-code').value = '';
                document.getElementById('auth-amount-group').style.display = 'none';
                document.getElementById('auth-title').innerText = "OVERSEER AUTHORIZATION";
                document.getElementById('auth-desc').innerText = "Enter security code to RESTRICT Admin / Overseer tools.";
                document.getElementById('auth-modal').style.display = 'flex';
            } else {
                // To turn it ON, they must provide the PIN
                pendingAuthAction = 'TOGGLE_DEV';
                document.getElementById('auth-code').value = '';
                document.getElementById('auth-amount-group').style.display = 'none';
                document.getElementById('auth-title').innerText = "OVERSEER AUTHORIZATION";
                document.getElementById('auth-desc').innerText = "Enter security code to unlock Admin / Overseer tools.";
                document.getElementById('auth-modal').style.display = 'flex';
            }
        }

        // v0.48: the actual lockout — lives behind the PIN via confirmAuth('TOGGLE_DEV_OFF')
        function doDevDisable() {
            localStorage.setItem('pipboy-dev-mode', 'false');
            // Manually hide elements that should disappear immediately (null-guarded: some
            // of these ids only exist on certain layouts — never let one 404 kill the rest)
            ['add-item-btn', 'add-quest-btn', 'faction-controls', 'dev-add-marker-btn',
             'dev-remove-marker-btn', 'dev-add-one-btn', 'dev-remove-one-btn'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            // v0.46: PARIAH WATCH dies with Overseer mode
            const opEl = document.getElementById('overseer-pariahs');
            if (opEl) { opEl.style.display = 'none'; opEl.innerHTML = ''; }
        }

        function triggerDevReset() {
            showCustomPrompt("INITIATE FULL FACTORY RESET? THIS WILL WIPE ALL LOCALLY SAVED DATA (USER, ITEMS, QUESTS, FACTIONS, WAYPOINTS).", [
                {
                    label: "YES, WIPE MEMORY",
                    color: "#ff3333",
                    action: () => {
                        localStorage.clear();
                        window.location.reload();
                    }
                },
                {
                    label: "CANCEL",
                    color: "var(--pip-color-dim)",
                    action: () => { /* Do nothing */ }
                }
            ]);
        }

        // Custom CSS for map tooltips to match Pip-Boy style
        const style = document.createElement('style');
        style.innerHTML = `
            .pip-tooltip {
                background-color: var(--pip-bg) !important;
                color: var(--pip-color) !important;
                border: 1px solid var(--pip-color) !important;
                font-family: 'VT323', monospace !important;
                font-size: 1.1rem !important;
                box-shadow: 0 0 5px var(--pip-color) !important;
                text-shadow: none !important;
            }
            .pip-tooltip::before { display: none !important; }
        `;
        document.head.appendChild(style);

        // Camera & Photo Mode Logic
        let rawVideoStream = null;
        let currentFacingMode = "environment";
        let cameraDeviceList = [];      // all physical video inputs (from enumerateDevices)
        let activeDeviceId = null;      // deviceId of the currently open stream
        let preferredDeviceId = null;   // user's chosen camera (survives tab switches)

        async function refreshCameraList() {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                cameraDeviceList = devices.filter(d => d.kind === 'videoinput');
            } catch (e) {
                cameraDeviceList = [];
            }
        }

        function inferFacingFromLabel(label) {
            if (!label) return null;
            const l = String(label).toLowerCase();
            if (l.includes('front') || l.includes('facetime') || l.includes('face time') || l.includes('selfie') || l.includes('user')) return 'user';
            if (l.includes('back') || l.includes('rear') || l.includes('environment') || l.includes('world')) return 'environment';
            return null;
        }
        
        // ==================== NIGHT MODE (v0.35) ====================
        // Dual approach to "can't see at night": (1) digital gain -- re-derive the theme
        // sensor filter with boosted brightness; (2) hardware torch via track.applyConstraints
        // (Android Chrome on rear sensors; iOS Safari has no browser torch -> boost only).
        let camNightMode = false;

        function applyCamFilter() {
            const base = themes[currentThemeIndex].camFx;
            const fx = camNightMode ? base + ' brightness(2.0) saturate(0.75)' : base;
            document.documentElement.style.setProperty('--cam-filter', fx);
        }

        async function applyTorch(on) {
            try {
                if (!rawVideoStream) return false;
                const track = rawVideoStream.getVideoTracks()[0];
                const caps = track.getCapabilities ? track.getCapabilities() : {};
                if (!caps || !('torch' in caps)) return false; // iOS / front cam / desktop: no torch
                await track.applyConstraints({ advanced: [{ torch: !!on }] });
                return true;
            } catch (e) { return false; }
        }

        async function toggleNightMode() {
            camNightMode = !camNightMode;
            let torchState = '';
            if (rawVideoStream) {
                const ok = await applyTorch(camNightMode);
                torchState = ok ? ' + FLASHLIGHT ON' : '';
                if (camNightMode && !ok) torchState = ' (NO FLASHLIGHT ON THIS DEVICE)';
            }
            applyCamFilter();
            const btn = document.getElementById('cam-night-btn');
            if (btn) btn.innerText = camNightMode ? '◧ NIGHT MODE: ON' : '◧ NIGHT MODE: OFF';
            showNotification(camNightMode ? ('NIGHT MODE ENGAGED: SENSOR GAIN BOOSTED' + torchState) : 'NIGHT MODE DISENGAGED.');
        }

        async function startCamera() {
            const video = document.getElementById('cam-video');
            const placeholder = document.getElementById('cam-placeholder');
            const startBtn = document.getElementById('cam-start-btn');
            const snapBtn = document.getElementById('cam-snap-btn');
            const flipBtn = document.getElementById('cam-flip-btn');
            const crtOverlay = document.getElementById('cam-crt-overlay');
            const reticle = document.getElementById('cam-reticle');

            // Force close any background instances of html5QrCode before requesting a raw stream
            if (html5QrCode && html5QrCode.isScanning) {
                await stopQRScanner();
                // Brief pause to ensure OS hardware lock is fully released
                await new Promise(r => setTimeout(r, 200)); 
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                showNotification("CAMERA API NOT SUPPORTED. PLEASE USE SECURE HTTPS.");
                return;
            }

            if (rawVideoStream) {
                rawVideoStream.getTracks().forEach(track => track.stop());
            }

            // Prefer an explicit deviceId chosen by flipCamera; fall back to facingMode,
            // then to a bare video request (avoids Android hardware rejections).
            const constraints = {
                video: preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : { facingMode: currentFacingMode },
                audio: false
            };

            try {
                let stream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (err) {
                    console.warn("facingMode specific stream failed, trying generic video...", err);
                    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                }

                rawVideoStream = stream;
                video.srcObject = stream;

                // Record WHICH physical camera we got, and mirror only front/selfie cameras
                try {
                    const track = stream.getVideoTracks()[0];
                    const settings = track.getSettings ? track.getSettings() : {};
                    if (settings && settings.deviceId) activeDeviceId = settings.deviceId;
                    if (cameraDeviceList.length === 0) refreshCameraList(); // background refresh for flip/labels

                    let mirror = false;
                    if (settings && settings.facingMode === 'user') {
                        mirror = true;
                    } else {
                        const dev = cameraDeviceList.find(function(d){ return d.deviceId === activeDeviceId; });
                        const inferred = dev ? inferFacingFromLabel(dev.label) : null;
                        mirror = inferred ? (inferred === 'user') : (currentFacingMode === 'user');
                    }
                    video.style.transform = mirror ? 'scaleX(-1)' : 'scaleX(1)';
                } catch(e) {
                // v0.58: NO mirror on front-camera preview — text/signs must read correctly
                video.style.transform = 'scaleX(1)';
            }

            // Re-arm the torch if NIGHT MODE survived a stream restart (flip/power-cycle)
            if (camNightMode) applyTorch(true);

            // Fix for Android blank screens: Force video to play explicitly
                // Some browsers return a promise from play()
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.warn("Auto-play prevented", e);
                        // If it fails to play automatically, the video feed might just freeze black.
                        // We will allow the UI to load anyway, some OS just require a tap to unfreeze.
                    });
                }

                // UI Updates
                placeholder.style.display = 'none';
                video.style.display = 'block';
                crtOverlay.style.display = 'block';
                reticle.style.display = 'block';
                document.getElementById('cam-menu-state').style.display = 'none';
                document.getElementById('cam-active-state').style.display = 'flex';
                startBtn.style.display = 'none';
                snapBtn.style.display = 'block';
                flipBtn.style.display = 'block';

                // Camera permission popup resolved; restore fullscreen if it was dropped
                restoreFullscreenIfDesired();

            } catch(err) {
                console.error(err);
                restoreFullscreenIfDesired();
                showNotification("CAMERA ACCESS DENIED OR HARDWARE UNAVAILABLE.");
            }
        }

        async function flipCamera() {
            // Toggle intent first (used when the device only exposes one camera)
            currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
            preferredDeviceId = null;

            // HARD RESTART with an explicit deviceId -- NEVER track.applyConstraints(),
            // which can resolve successfully WITHOUT actually switching physical sensors
            // (that was the "flip only mirrors left/right" bug).
            if (rawVideoStream) {
                rawVideoStream.getTracks().forEach(track => track.stop());
                rawVideoStream = null;
            }

            await refreshCameraList();
            if (cameraDeviceList.length > 1) {
                let idx = cameraDeviceList.findIndex(function(d){ return d.deviceId === activeDeviceId; });
                if (idx === -1) idx = 0; // unknown current cam: jump off the first one
                const next = cameraDeviceList[(idx + 1) % cameraDeviceList.length];
                preferredDeviceId = next.deviceId;
                const inferred = inferFacingFromLabel(next.label);
                if (inferred) currentFacingMode = inferred; // keeps mirroring correct
            }

            await startCamera();
        }

        function stopCamera() {
            if (rawVideoStream) {
                rawVideoStream.getTracks().forEach(track => track.stop());
                rawVideoStream = null;
            }
            
            // Reset UI
            document.getElementById('cam-video').style.display = 'none';
            document.getElementById('cam-canvas').style.display = 'none';
            document.getElementById('cam-crt-overlay').style.display = 'none';
            document.getElementById('cam-reticle').style.display = 'none';
            document.getElementById('cam-placeholder').style.display = 'block';
            document.getElementById('cam-active-state').style.display = 'none';
            document.getElementById('cam-menu-state').style.display = 'flex';
            document.getElementById('cam-start-btn').style.display = 'block';
            document.getElementById('cam-snap-btn').style.display = 'none';
            document.getElementById('cam-flip-btn').style.display = 'none';
            document.getElementById('cam-save-controls').style.display = 'none';
        }

        async function takePhoto() {
            const video = document.getElementById('cam-video');
            // v0.43 RACE GUARD (was "flipping stops being able to save photos"): a flip or
            // restart leaves the element mid-wake with a 0x0 frame, and the old code
            // happily 'saved' black nothing -- or wedged. Wait for a REAL frame instead.
            if (!rawVideoStream || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
                showNotification('SENSOR RESTARTING -- HOLD POSITION...');
                return;
            }
            // v0.43 SELFIE SCREEN-FLASH: front sensors have no torch -- in NIGHT MODE the
            // whole screen floods pale for a beat as the light, and we shoot mid-flash.
            const isFront = (currentFacingMode === 'user');
            const flash = document.getElementById('cam-screenflash');
            if (camNightMode && isFront && flash) {
                flash.style.display = 'block';
                await new Promise(r => setTimeout(r, 180));
            }
            try {
                const canvas = document.getElementById('cam-canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');

                // v0.58: NO mirror on saved selfie — text/signs must be readable in the photo
                // (previously front-camera shots were horizontally flipped)
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                ctx.setTransform(1, 0, 0, 1, 0, 0);

                // v0.43: capture auto-archives BOTH versions instantly -- no separate
                // save step exists anymore, so 'save' is live by construction
                archiveShot(canvas);

                // Freeze on the picture + release the sensor (battery)
                video.style.display = 'none';
                canvas.style.display = 'block';
                if (rawVideoStream) {
                    rawVideoStream.getTracks().forEach(track => track.stop());
                    rawVideoStream = null;
                }
                document.getElementById('cam-snap-btn').style.display = 'none';
                document.getElementById('cam-flip-btn').style.display = 'none';
                document.getElementById('cam-save-controls').style.display = 'flex';
            } catch (err) {
                showNotification('CAPTURE FAILED: ' + String((err && err.message) || 'SENSOR ERROR').toUpperCase());
            } finally {
                if (flash) flash.style.display = 'none';
            }
        }

        function resetCamera() {
            document.getElementById('cam-canvas').style.display = 'none';
            document.getElementById('cam-save-controls').style.display = 'none';
            startCamera(); // Reboot the feed
        }

        // Post-shot regret: drop the shot we just auto-archived, then back to the feed
        function deleteLastShot() {
            if (photoArchive.length) {
                photoArchive.shift();
                try { localStorage.setItem('pipboy-photos', JSON.stringify(photoArchive)); } catch (e) {}
                renderPhotoGallery();
                showNotification('LAST SHOT DELETED FROM DATABANK.');
            }
            resetCamera();
        }

        let photoArchive = JSON.parse(localStorage.getItem('pipboy-photos')) || [];

        // ================= v0.43 DUAL-CAPTURE ARCHIVE ENGINE =================
        // One capture -> TWO artifacts in the DATABANK as one paired entry {pip, raw}:
        //   RAW = unfiltered full-res truth + subtle timestamp
        //   PIP = theme-baked (camFx + NIGHT MODE gain), downscaled, watermarked,
        //         timestamped phosphor artifact
        // DATABANK entry shape migrated: legacy entries were bare dataURL strings;
        // entryPip()/entryRaw() read both shapes so old shots never break.
        function entryPip(e) { return (typeof e === 'string') ? e : (e.pip || e.raw || ''); }
        function entryRaw(e) { return (e && typeof e === 'object') ? (e.raw || null) : null; }

        function stampTimestamp(ctx, w, h, color, alpha) {
            const now = new Date();
            const p2 = n => String(n).padStart(2, '0');
            // In-fiction year offset: 2026 -> 2287, matching the pip-clock's world
            const stamp = `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${now.getFullYear() + 261} ${p2(now.getHours())}:${p2(now.getMinutes())}`;
            const size = Math.max(14, Math.floor(w / 45));
            ctx.save();
            ctx.filter = 'none';
            ctx.globalAlpha = alpha; // subtle by design: readable when sought, invisible when not
            ctx.fillStyle = color;
            ctx.font = `${size}px 'Courier New', Courier, monospace`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(stamp, w - size, h - size);
            ctx.restore();
        }

        function archiveShot(canvas) {
            const t = themes[currentThemeIndex];
            let pipURL = null, rawURL = null;
            // RAW -- also doubles as the emergency fallback path
            try {
                const raw = document.createElement('canvas');
                raw.width = canvas.width; raw.height = canvas.height;
                const rctx = raw.getContext('2d');
                rctx.drawImage(canvas, 0, 0);
                stampTimestamp(rctx, raw.width, raw.height, '#dddddd', 0.45);
                rawURL = raw.toDataURL('image/jpeg', 0.82);
            } catch (e) { rawURL = null; }
            // PIP -- theme phosphor crush + watermark + timestamp
            try {
                const sf = 1.0; // v0.67: full resolution (was 0.5)
                const baked = document.createElement('canvas');
                baked.width = Math.max(1, Math.floor(canvas.width * sf));
                baked.height = Math.max(1, Math.floor(canvas.height * sf));
                const bctx = baked.getContext('2d');
                bctx.fillStyle = 'black';
                bctx.fillRect(0, 0, baked.width, baked.height);
                bctx.filter = t.camFx + (camNightMode ? ' brightness(2.0) saturate(0.75)' : '');
                bctx.drawImage(canvas, 0, 0, baked.width, baked.height);
                bctx.filter = 'none';
                bctx.fillStyle = t.hex;
                bctx.font = "20px 'Courier New', Courier, monospace";
                bctx.fillText('POX-BOY 3026 OS', 10, 30);
                stampTimestamp(bctx, baked.width, baked.height, t.hex, 0.45);
                pipURL = baked.toDataURL('image/jpeg', 0.85); // v0.67: higher quality (was 0.6)
            } catch (e) { pipURL = null; }
            // GUARANTEE last resort: raw frame straight off the capture canvas
            if (!pipURL && !rawURL) {
                try { rawURL = canvas.toDataURL('image/jpeg', 0.7); } catch (e) {}
            }
            if (!pipURL && !rawURL) {
                showNotification('PHOTO LOST: SENSOR FRAME UNREADABLE.'); // LOUD failure, never silent
                return false;
            }
            archiveEntry({ pip: pipURL, raw: rawURL });
            return true;
        }

        function archiveEntry(entry) {
            photoArchive.unshift(entry);
            let pruned = 0;
            for (;;) {
                try { localStorage.setItem('pipboy-photos', JSON.stringify(photoArchive)); break; }
                catch (e) {
                    if (photoArchive.length <= 1) {
                        photoArchive.shift();
                        showNotification('DATABANK FULL -- DELETE OLD SHOTS.');
                        return;
                    }
                    photoArchive.pop(); pruned++;
                }
            }
            if (pruned) showNotification('DATABANK PRESSURE: ' + pruned + ' OLDEST SHOT' + (pruned > 1 ? 'S' : '') + ' PURGED.');
            renderPhotoGallery();
            const saved = photoArchive[0];
            showNotification('PHOTO SECURED: ' + (saved.raw && saved.pip ? 'RAW + PIP ' : '') + '(' + photoArchive.length + ' IN DATABANK).');
            if (localStorage.getItem('pipboy-auto-export') === '1') exportEntry(saved);
        }

        // ================= GALLERY EXPORT / SHARE (v0.43) =================
        function downloadDataUrl(dataURL, filename) {
            if (!dataURL) return;
            const a = document.createElement('a');
            a.href = dataURL;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        function exportEntry(entry) {
            const stamp = Date.now();
            downloadDataUrl(entryPip(entry), `POXBOY_${stamp}_PIP.jpg`);
            const raw = entryRaw(entry);
            if (raw) downloadDataUrl(raw, `POXBOY_${stamp}_RAW.jpg`);
            coachExportOnce();
        }

        // One-time coaching: files land in Download (gallery apps index it), and Chrome's
        // "download complete" pings can be silenced at the OS level once, forever.
        function coachExportOnce() {
            if (localStorage.getItem('pipboy-export-coached')) return;
            localStorage.setItem('pipboy-export-coached', '1');
            showCustomPrompt('EXPORTS LAND IN YOUR DOWNLOAD FOLDER -- GALLERY APPS INDEX IT AUTOMATICALLY. FOR SILENT FUTURE EXPORTS: LONG-PRESS THE NEXT DOWNLOAD NOTIFICATION AND TURN OFF "DOWNLOADS" PINGS.', [
                { label: 'UNDERSTOOD', action: () => {} }
            ]);
        }

        // v0.44 (user direction): per-image SHARE removed entirely, per-image EXPORT
        // replaced by one bulk control on the CAM databank bar.
        function exportAllPhotos() {
            if (!photoArchive.length) return showNotification('DATABANK EMPTY.');
            const jobs = [];
            photoArchive.forEach((e, i) => {
                jobs.push({ url: entryPip(e), name: `POXBOY_${i + 1}_PIP.jpg` });
                const raw = entryRaw(e);
                if (raw) jobs.push({ url: raw, name: `POXBOY_${i + 1}_RAW.jpg` });
            });
            showCustomPrompt(`EXPORT ALL ${jobs.length} IMAGES (PIP + RAW VERSIONS) TO YOUR DOWNLOAD FOLDER? TAP "ALLOW" IF THE BROWSER ASKS ABOUT MULTIPLE DOWNLOADS.`, [
                {
                    label: 'EXPORT ALL',
                    action: () => {
                        jobs.forEach((j, i) => setTimeout(() => downloadDataUrl(j.url, j.name), i * 350));
                        coachExportOnce();
                    }
                },
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        // OPTIONS cycle
        function cycleAutoExport() {
            const on = localStorage.getItem('pipboy-auto-export') !== '1';
            localStorage.setItem('pipboy-auto-export', on ? '1' : '0');
            const btn = document.getElementById('options-export-btn');
            if (btn) btn.innerText = `[AUTO-EXPORT: ${on ? 'ON' : 'OFF'}]`;
            showNotification('AUTO-EXPORT ' + (on ? 'ON -- EVERY SHOT ALSO FILES TO THE GALLERY-INDEXED DOWNLOAD FOLDER.' : 'OFF.'));
        }
        // Boot label sync
        (function() {
            const b = document.getElementById('options-export-btn');
            if (b && localStorage.getItem('pipboy-auto-export') === '1') b.innerText = '[AUTO-EXPORT: ON]';
        })();

        // ================= TEXT SIZE CYCLE (v0.44) =================
        // Every element in the app is rem-scaled, so the whole UI resizes from the root.
        // 16px = the size every layout was tuned at; deploy is invisible until tapped.
        // Persisted in pipboy-font-index, applied at boot.
        const textSizes = ['16px', '18px', '20px'];   // NORMAL 100% / LARGE 112.5% / XL 125%
        const textLabels = ['NORMAL', 'LARGE', 'XL'];
        let textSizeIndex = (function() {
            const i = parseInt(localStorage.getItem('pipboy-font-index'), 10);
            return (i >= 0 && i < textSizes.length) ? i : 0;
        })();
        function applyTextSize() {
            document.documentElement.style.fontSize = textSizes[textSizeIndex];
            const btn = document.getElementById('options-text-btn');
            if (btn) btn.innerText = `[TEXT: ${textLabels[textSizeIndex]}]`;
        }
        function cycleTextSize() {
            textSizeIndex = (textSizeIndex + 1) % textSizes.length;
            localStorage.setItem('pipboy-font-index', textSizeIndex);
            applyTextSize();
        }
        applyTextSize(); // boot: apply persisted preference + paint the button

        function renderPhotoGallery() {
            const galleryEl = document.getElementById('inline-photo-gallery');
            if (!galleryEl) return;

            galleryEl.innerHTML = '';

            if (photoArchive.length === 0) {
                galleryEl.innerHTML = '<p style="text-align:center; opacity:0.5; margin-top:40px; font-size:1.2rem;">NO IMAGES IN DATABANK</p>';
                return;
            }

            // Small tiles; tapping one opens the fullscreen-ish viewer modal
            // (v0.43: tiles always show the PIP version; RAW lives behind the viewer toggle)
            let html = '<div class="photo-tile-grid">';
            photoArchive.forEach((entry, idx) => {
                html += `<div class="photo-tile" onclick="openPhotoViewer(${idx})"><img src="${entryPip(entry)}" alt="ARCHIVE ${idx + 1}"></div>`;
            });
            html += '</div>';
            galleryEl.innerHTML = html;
        }

        // Databank fullscreen viewer (image always fits: max 78vh, no scrolling)
        let viewerPhotoIdx = null;
        let viewerShowingRaw = false; // v0.43: PIP vs RAW flip state

        function openPhotoViewer(idx) {
            if (idx < 0 || idx >= photoArchive.length) return;
            viewerPhotoIdx = idx;
            viewerShowingRaw = false;
            refreshViewer();
            document.getElementById('photo-viewer-modal').style.display = 'flex';
        }

        function refreshViewer() {
            const entry = photoArchive[viewerPhotoIdx];
            const raw = entryRaw(entry);
            document.getElementById('photo-viewer-img').src = (viewerShowingRaw && raw) ? raw : entryPip(entry);
            const tog = document.getElementById('photo-viewer-toggle');
            if (tog) {
                tog.style.display = raw ? 'block' : 'none'; // hidden for legacy/mail-received (PIP-only) shots
                tog.innerText = viewerShowingRaw ? 'VIEW PIP-BOY VERSION' : 'VIEW ORIGINAL';
            }
        }

        function toggleViewerVersion() {
            viewerShowingRaw = !viewerShowingRaw;
            refreshViewer();
        }

        function closePhotoViewer() {
            viewerPhotoIdx = null;
            document.getElementById('photo-viewer-modal').style.display = 'none';
        }

        function deleteViewerPhoto() {
            if (viewerPhotoIdx === null) return;
            const idx = viewerPhotoIdx;
            showCustomPrompt("DELETE THIS IMAGE FROM DATABANKS?", [
                {
                    label: "YES, DELETE",
                    color: "#ff3333",
                    action: () => {
                        photoArchive.splice(idx, 1);
                        localStorage.setItem('pipboy-photos', JSON.stringify(photoArchive));
                        closePhotoViewer();
                        renderPhotoGallery();
                    }
                },
                { label: "CANCEL", color: "var(--pip-color-dim)", action: () => {} }
            ]);
        }

        // We override this to just trigger the render since we are now inline
        function openPhotoArchive() {
            stopCamera();
            document.getElementById('cam-active-state').style.display = 'none';
            document.getElementById('cam-menu-state').style.display = 'flex';
            renderPhotoGallery();
        }

        function deletePhoto(idx) {
            showCustomPrompt("DELETE THIS IMAGE FROM DATABANKS?", [
                {
                    label: "YES, DELETE",
                    color: "#ff3333",
                    action: () => {
                        photoArchive.splice(idx, 1);
                        localStorage.setItem('pipboy-photos', JSON.stringify(photoArchive));
                        renderPhotoGallery(); // refresh gallery
                    }
                },
                { label: "CANCEL", color: "var(--pip-color-dim)", action: () => {} }
            ]);
        }

        function closePhotoArchive() {
            document.getElementById('photo-archive-modal').style.display = 'none';
            // Stop the camera completely and revert to the root menu state
            stopCamera();
            document.getElementById('cam-active-state').style.display = 'none';
            document.getElementById('cam-menu-state').style.display = 'flex';
        }

        // ==================== P2P COMMS STACK (v0.31) ====================
        // Datacard identity + WASTELANDERS MET rolodex + Firebase mailbox
        // (quests / items / messages) + one-scan mutual handshake + UNVERIFIED
        // quarantine. localStorage stays the store of record (directive 7);
        // Firebase is only the postal service.

        // --- Identity: the UID now exists at boot, not just when GPS is enabled ---
        let myMailUid = localStorage.getItem('pipboy-uid');
        if (!myMailUid) {
            myMailUid = 'user_' + Date.now() + Math.floor(Math.random()*1000);
            localStorage.setItem('pipboy-uid', myMailUid);
        }

        // --- Comms state (all persisted locally) ---
        let rolodex = JSON.parse(localStorage.getItem('pipboy-rolodex') || '[]');
        let outbox = JSON.parse(localStorage.getItem('pipboy-outbox') || '[]');
        let mailLog = JSON.parse(localStorage.getItem('pipboy-maillog') || '[]');
        let mailSeen = JSON.parse(localStorage.getItem('pipboy-mail-seen') || '[]');
        let mailProcessed = JSON.parse(localStorage.getItem('pipboy-mail-processed') || '[]');
        let inboxLetters = {};       // live mailbox snapshot, trusted senders only
        let unverifiedLetters = {};  // live quarantine bucket, unknown senders
        // v0.45: parked link requests (NOTIFY LINKS off = datacard scans wait quietly
        // as a MAIL tab row instead of jumping a pop-up in your face)
        let linkScans = JSON.parse(localStorage.getItem('pipboy-linkscans') || '{}');
        let contactUidTarget = null; // recipient of the current composer / contact sheet
        let replyToKey = null; // v0.61: track which message key we're replying to, so we can auto-log it
        let selectedBeaconUid = null;
        let lastKnownBeaconData = {};
        let myLastLat = null, myLastLng = null;
        let ciSelectedItemId = null;

        function saveComms() {
            localStorage.setItem('pipboy-rolodex', JSON.stringify(rolodex));
            localStorage.setItem('pipboy-outbox', JSON.stringify(outbox));
            localStorage.setItem('pipboy-maillog', JSON.stringify(mailLog));
            localStorage.setItem('pipboy-mail-seen', JSON.stringify(mailSeen.slice(-500)));
            localStorage.setItem('pipboy-linkscans', JSON.stringify(linkScans)); // v0.45
        }
        function saveProcessed() {
            localStorage.setItem('pipboy-mail-processed', JSON.stringify(mailProcessed.slice(-500)));
        }
        function contactByUid(uid) { return rolodex.find(c => c.uid === uid) || null; }
        function isContact(uid) { return !!contactByUid(uid); }
        function escapeHtml(s) {
            return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        }
        function mailTabActive() {
            const t = document.getElementById('tab-mail'); // v0.53: MAIL is a top-level tab
            return !!t && t.classList.contains('active');
        }
        function safeUid(uid) { return String(uid || '').replace(/[^A-Za-z0-9_\-]/g, ''); }
        // v0.48: hoisted GLOBAL (was a closure inside renderMail — a ReferenceError in
        // renderContracts/renderPariahPanel silently blanked those tabs the moment a row existed)
        function timeOf(ts) { return new Date(ts || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}); }

        // --- MY DATACARD: broadcast identity QR (plain-text, not JSON) ---
        function openDatacard() {
            document.getElementById('datacard-name').innerText = userProfile.name || 'UNKNOWN';
            // v0.52: your own card shows your LIVE vitals bar (no beacon staleness here)
            const dv = document.getElementById('dc-vitals');
            if (dv) {
                const r = userProfile.rads || 0;
                dv.innerHTML = vitalsBarHtml(Math.max(0, userProfile.maxHp - Math.floor((r / 1000) * userProfile.maxHp)), r);
            }
            const canvas = document.getElementById('datacard-qr-canvas');
            canvas.innerHTML = '';
            new QRCode(canvas, {
                text: 'poxboy:' + myMailUid + ':' + (userProfile.name || 'UNKNOWN'),
                width: 220,
                height: 220,
                colorDark : '#051005',
                colorLight : '#1aff80',
                correctLevel : QRCode.CorrectLevel.L
            });
            document.getElementById('datacard-modal').style.display = 'flex';
        }

        // --- PROFILE SCAN: add to rolodex + fire the one-scan handshake letter ---
        function handleDatacardScan(text) {
            const rest = text.slice('poxboy:'.length);
            const sep = rest.indexOf(':');
            const uid = sep > -1 ? rest.slice(0, sep) : rest;
            const name = (sep > -1 ? rest.slice(sep + 1) : 'UNKNOWN WASTELANDER').toUpperCase();
            if (!uid) { showNotification('DATACARD CORRUPTED. RESCAN.'); return; }
            if (uid === myMailUid) { showNotification('THAT IS YOUR OWN DATACARD, WASTELANDER.'); return; }
            
            // v0.70: Check for pending bounty claim
            if (window.pendingBountyClaim && window.pendingBountyClaim.bounty.targetUid === uid) {
                const bountyId = window.pendingBountyClaim.id;
                const myUid = localStorage.getItem('pipboy-uid');
                const myName = userProfile.name || 'UNKNOWN';
                
                window.firebaseUpdate(window.firebaseRef(window.db, 'bounties/' + bountyId), {
                    status: 'claimed',
                    claimedBy: myUid,
                    claimedByName: myName,
                    claimedAt: Date.now()
                })
                    .then(() => {
                        showNotification('BOUNTY CLAIMED - AWAITING VERIFICATION');
                        window.pendingBountyClaim = null;
                        renderBounties();
                    })
                    .catch(err => {
                        showNotification('ERROR CLAIMING BOUNTY: ' + err.message);
                        window.pendingBountyClaim = null;
                    });
                return;
            }
            
            if (isContact(uid)) { showNotification(contactByUid(uid).name + ' ALREADY LOGGED IN WASTELANDERS MET.'); return; }
            showCustomPrompt('ADD ' + name + ' TO WASTELANDERS MET? THEY WILL BE NOTIFIED OF THE LINK.', [
                {
                    label: 'ADD CONTACT + SEND LINK',
                    action: () => {
                        addContact(uid, name);
                        sendHandshake(uid);
                        if (currentDataTab === 'wastelanders') { renderWastelanders(); renderLinkRequests(); }
                    }
                },
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        function addContact(uid, name) {
            if (isContact(uid)) return;
            rolodex.push({ uid: uid, name: name || 'UNKNOWN', metAt: Date.now() });
            saveComms();
            // Promote any quarantined transmissions from this frequency into the live inbox
            let promoted = 0;
            for (let key in unverifiedLetters) {
                if (unverifiedLetters[key].from === uid) {
                    inboxLetters[key] = unverifiedLetters[key];
                    delete unverifiedLetters[key];
                    promoted++;
                }
            }
            showNotification('CONTACT SECURED: ' + (name || 'UNKNOWN') + (promoted ? ' (' + promoted + ' HELD TRANSMISSION' + (promoted > 1 ? 'S' : '') + ' UNLOCKED)' : ''));
            renderMailBadge();
        }

        // One-scan mutual link: scanning a datacard posts a handshake into THEIR mailbox;
        // them accepting puts YOU in THEIR rolodex. (Spam-proof: the letter can only
        // exist if you were physically shown their card.)
        function sendHandshake(uid) {
            // v0.34 BUGFIX: payload must be NON-EMPTY. The published Firebase rules require
            // hasChildren([...'payload']), but RTDB treats an empty object as a delete, so
            // old handshakes arrived invalid and the outbox entry stuck at QUEUED forever.
            queueMail(uid, 'handshake', { kind: 'link' }, 'LINK REQUEST');
        }

        // Sending your datacard to a known contact via mail (their prompt = same as being scanned):
        // useful when they declined earlier, or their rolodex was wiped and you still have theirs.
        function sendDatacardViaMail() {
            const c = contactByUid(contactUidTarget);
            if (!c) return closeModals();
            showCustomPrompt('TRANSMIT YOUR DATACARD TO ' + c.name + '? THEY WILL GET A LINK REQUEST JUST AS IF THEY SCANNED YOU.', [
                {
                    label: 'SEND DATACARD',
                    action: () => {
                        sendHandshake(c.uid);
                        closeModals();
                        notifyTxResult();
                        renderLinkRequests();
                    }
                },
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        function addContact(uid, name) {
            if (isContact(uid)) return;
            rolodex.push({ uid: uid, name: name || 'UNKNOWN', metAt: Date.now() });
            saveComms();
            // Promote any quarantined transmissions from this frequency into the live inbox
            let promoted = 0;
            for (let key in unverifiedLetters) {
                if (unverifiedLetters[key].from === uid) {
                    inboxLetters[key] = unverifiedLetters[key];
                    delete unverifiedLetters[key];
                    promoted++;
                }
            }
            // v0.34: the link is now live, so retire our pending handshake letters to them
            pruneHandshakeOutbox(uid);
            showNotification('CONTACT SECURED: ' + (name || 'UNKNOWN') + (promoted ? ' (' + promoted + ' HELD TRANSMISSION' + (promoted > 1 ? 'S' : '') + ' UNLOCKED)' : ''));
            renderMailBadge();
        }

        function pruneHandshakeOutbox(uid) {
            let changed = false;
            for (let i = outbox.length - 1; i >= 0; i--) {
                const e = outbox[i];
                if (e.type === 'handshake' && e.to === uid) {
                    if (e.key && window.db) {
                        window.firebaseRemove(window.firebaseRef(window.db, 'mail/' + e.to + '/' + e.key)).catch(() => {});
                    }
                    outbox.splice(i, 1);
                    changed = true;
                }
            }
            if (changed) saveComms();
        }

        // --- OUTBOX: queue offline, flush when the satellite comes back ---
        function queueMail(toUid, type, payload, summary) {
            const entry = {
                id: 'ob' + Date.now() + '_' + Math.floor(Math.random()*100000),
                to: toUid, type: type, payload: payload,
                summary: summary || type.toUpperCase(),
                status: 'queued', ts: Date.now(), key: null
            };
            outbox.push(entry);
            saveComms();
            flushOutbox();
            renderMailBadge();
            return entry;
        }

        function flushOutbox() {
            if (!window.db) return;
            outbox.forEach(entry => {
                if (entry.status !== 'queued') return;
                entry.status = 'sending';
                const key = 'm' + entry.ts + '_' + Math.floor(Math.random()*1000000);
                const letter = { type: entry.type, from: myMailUid, fromName: userProfile.name || 'UNKNOWN', ts: entry.ts, payload: entry.payload };
                window.firebaseSet(window.firebaseRef(window.db, 'mail/' + entry.to + '/' + key), letter)
                    .then(() => {
                        entry.status = 'sent';
                        entry.key = key;
                        saveComms();
                        if (mailTabActive()) renderMail();
                    })
                    .catch(() => { entry.status = 'queued'; });
            });
            saveComms();
        }

        // Lazy status read on mailed letters (AWAITING → ACCEPTED / DECLINED / FULFILLED)
        let outboxRefreshRunning = false;
        function refreshOutboxStatuses() {
            if (!window.db || outboxRefreshRunning) return;
            const pending = outbox.filter(e => e.key && e.status === 'sent');
            if (!pending.length) return;
            outboxRefreshRunning = true;
            let left = pending.length;
            const doneOne = () => { if (--left <= 0) { outboxRefreshRunning = false; saveComms(); if (mailTabActive()) renderMail(); } };
            pending.forEach(e => {
                window.firebaseGet(window.firebaseRef(window.db, 'mail/' + e.to + '/' + e.key))
                    .then(snap => {
                        const v = snap.val();
                        if (!v) {
                            if (e.type === 'handshake') e.status = 'closed'; // receiver processed + retired the letter
                        } else if (v.fulfilled) {
                            e.status = 'fulfilled';
                        } else if (v.claimed) {
                            e.status = 'accepted';
                            // v0.45: senders used to get SILENCE when a contract/shipment was
                            // picked up — the feed just flipped quietly. Now it tells you,
                            // gated by NOTIFY CONTRACTS
                            if (notifyPref('contract') && e.type !== 'msg') { // v0.56: plain messages stop ack-pinging the sender (user: "reply is the receipt")
                                const who = String((contactByUid(e.to) || {}).name || e.to).toUpperCase();
                                const what = e.type === 'quest' ? 'CONTRACT' : (e.type === 'item' ? 'SHIPMENT' : 'TRANSMISSION');
                                showNotification(what + ' ACCEPTED BY ' + who);
                                mailPingOs(what + ' ACCEPTED BY ' + who);
                            }
                        } else if (v.declined) {
                            e.status = 'declined';
                            // MOVE policy: a declined shipment returns the goods to the sender —
                            // v0.47 extended to message letters carrying an attached ITEM pod
                            const refundPod = (e.type === 'item') ? e.payload
                                : (e.type === 'msg' && e.payload && e.payload.item) ? e.payload.item : null;
                            if (refundPod && !e.refunded) {
                                refundItemPayload(refundPod);
                                e.refunded = true;
                                if (notifyPref('contract')) showNotification('TRANSMISSION DECLINED — ITEM RETURNED TO INVENTORY.');
                            }
                        }
                    })
                    .catch(() => {})
                    .finally(doneOne);
            });
        }

        // Grant/merge an item payload into local inventory (used by acceptItem + refunds)
        function refundItemPayload(p) {
            const existing = items.find(i => i.name === p.name && i.type === p.type);
            if (existing) existing.quantity += (p.quantity || 1);
            else items.push({ id: Date.now(), name: p.name, type: p.type, effects: p.effects, quantity: p.quantity || 1, equipped: false });
            saveToStorage();
            renderInventory(currentInvTab);
        }

        function notifyTxResult() {
            if (window.db && navigator.onLine !== false) showNotification('TRANSMISSION SENT.');
            else showNotification('NO SIGNAL — TRANSMISSION QUEUED.');
        }

        // --- INBOX: mailbox listener (same firebaseOnValue pattern as the radar) ---
        function startMailListener() {
            window.firebaseOnValue(window.firebaseRef(window.db, 'mail/' + myMailUid), (snap) => {
                processInboxSnapshot(snap.val() || {});
            }, () => {}); // permission/offline errors: stay silent, we have local copies
        }

        // ================= RADIATION ENGINE (v0.46) =================
        // Two opposing 60-second processes, NEVER both at once:
        //   inside a pariah's field -> +1 RAD/min ("taking rads damage")
        //   everywhere else         -> -1 RAD/min passive recovery, floor 0
        let pariahMarks = {};       // uid -> {name, ts}: mirror of the Firebase pariahs/ node
        let radFieldActive = false; // hysteresis state: currently bathed in a pariah field
        let radFieldPariah = null;  // name of the source, for status purposes
        let medShelterActive = false; // v0.50: inside a ✚ MED ZONE fence (recovery x5)
        let radFieldRadius = 15;   // v0.56: radius of the field we're standing in (variable fences)
        let medShelterRadius = 15; // v0.56: radius of the shelter we're standing in
        // v0.58: decontamination station state
        let deconActive = false;   // currently inside a decon zone
        let deconFired = false;    // effect already fired this visit (once per entry)
        // v0.70: global contracts and bounties state
        let globalContracts = {}; // contractId -> contract data
        let bounties = {};        // bountyId -> bounty data

        function adjustRads(delta) {
            const before = userProfile.rads || 0;
            const after = Math.min(1000, Math.max(0, before + delta));
            if (after === before) return;
            // v0.57: track lifetime rads absorbed (positive deltas only)
            if (delta > 0) { bumpFunStat('radsTotal', delta); }
            // v0.57: near-death tracking (HP below 20%)
            const newHp = Math.max(0, userProfile.maxHp - Math.floor((after / 1000) * userProfile.maxHp));
            if (newHp < userProfile.maxHp * 0.2 && before < 1000 && newHp > 0) {
                const oldHp = Math.max(0, userProfile.maxHp - Math.floor((before / 1000) * userProfile.maxHp));
                if (oldHp >= userProfile.maxHp * 0.2) bumpFunStat('nearDeath', 1);
            }
            // v0.67: Glowing One transformation at 1000 rads
            if (after === 1000 && before < 1000 && !isGlowingOne && !glowingOneChecked) {
                glowingOneChecked = true;
                if (Math.random() < 0.1) {
                    // 1/10 chance: become a Glowing One
                    isGlowingOne = true;
                    localStorage.setItem('pipboy-glowing-one', 'true');
                    localStorage.setItem('pipboy-glowing-one-checked', 'true');
                    showNotification('☢ RADIATION SURGE — YOU HAVE BECOME A GLOWING ONE ☢');
                    bumpFunStat('glowingOne', 1);
                    // Announce to nearby players
                    if (window.db && myMailUid && myLastLat !== null) {
                        const announceRef = window.firebaseRef(window.db, 'glowingAnnouncements/' + myMailUid);
                        window.firebaseSet(announceRef, {
                            name: userProfile.name || 'UNKNOWN',
                            lat: myLastLat,
                            lng: myLastLng,
                            timestamp: Date.now()
                        }).catch(() => {});
                    }
                } else {
                    // 9/10 chance: die (0 HP)
                    showNotification('☢ CRITICAL RADIATION — YOU ARE DOWN ☢');
                    bumpFunStat('radDeaths', 1);
                }
            }
            // Reset Glowing One check when rads reset to 0
            if (after === 0 && before > 0) {
                glowingOneChecked = false;
                localStorage.removeItem('pipboy-glowing-one-checked');
            }
            userProfile.rads = after;
            saveToStorage();
            renderProfile();
            renderVaultBoyFx();
        }

        function evalPariahField() {
            // The condemned do not fear their own shadow: a declared pariah is self-immune…
            const selfMarked = !!(myMailUid && pariahMarks[myMailUid]);
            const selfGlowing = isGlowingOne; // v0.67: Glowing Ones are self-immune
            let nearest = null;
            if (myLastLat !== null && myLastLng !== null) {
                // …to PERSON fields. Stale signals do not irradiate: beacons older than
                // 5 minutes are ignored.
                if (!selfMarked && !selfGlowing) {
                    Object.keys(pariahMarks).forEach(uid => {
                        const b = lastKnownBeaconData[uid];
                        if (!b || !b.timestamp || (Date.now() - b.timestamp) > 5 * 60 * 1000) return;
                        if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return;
                        const d = getDistance(myLastLat, myLastLng, b.lat, b.lng);
                        if (!nearest || d < nearest.d) {
                            nearest = { d: d, name: ((pariahMarks[uid] || {}).name || b.name || 'PARIAH'), kind: 'PARIAH' };
                        }
                    });
                    // v0.67: Glowing Ones also emit radiation (15m radius)
                    Object.keys(lastKnownBeaconData).forEach(uid => {
                        const b = lastKnownBeaconData[uid];
                        if (!b || !b.glowingOne || uid === myMailUid) return; // skip self and non-glowing
                        if (!b.timestamp || (Date.now() - b.timestamp) > 5 * 60 * 1000) return; // stale
                        if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return;
                        const d = getDistance(myLastLat, myLastLng, b.lat, b.lng);
                        if (d <= 15 && (!nearest || d < nearest.d)) {
                            nearest = { d: d, name: (b.name || 'GLOWING ONE'), kind: 'GLOWING ONE' };
                        }
                    });
                }
                // Zones: HOT irradiates everyone who steps in — pariahs included;
                // v0.50: MED zones (kind 'med') never damage — they shelter, tracked separately
                let nearestMed = null;
                let nearestDecon = null; // v0.58: decontamination station
                Object.keys(lastKnownRadZones).forEach(zk => {
                    const z = lastKnownRadZones[zk];
                    if (!z || typeof z.lat !== 'number' || typeof z.lng !== 'number') return;
                    const d = getDistance(myLastLat, myLastLng, z.lat, z.lng);
                    const zr = (typeof z.radius === 'number') ? z.radius : 15;
                    if (z.kind === 'med') {
                        if (nearestMed === null || d < nearestMed.d) nearestMed = { d: d, r: zr };
                        return;
                    }
                    // v0.58: decon stations — tracked separately, once-per-entry effect
                    if (z.kind === 'decon') {
                        if (nearestDecon === null || d < nearestDecon.d) nearestDecon = { d: d, r: zr };
                        return;
                    }
                    if (!nearest || d < nearest.d) {
                        nearest = { d: d, name: ('☢ ' + (z.label || 'HOT ZONE')), kind: 'HOT ZONE', r: zr };
                    }
                });
                // v0.56: med shelter grabs at the zone's own radius, releases 20% past it
                if (!medShelterActive && nearestMed !== null && nearestMed.d <= nearestMed.r) { medShelterActive = true; medShelterRadius = nearestMed.r; }
                else if (medShelterActive && (nearestMed === null || nearestMed.d > medShelterRadius * 1.2)) medShelterActive = false;
                // v0.58: decon station hysteresis — once per entry, shed ALL rads + mutation strip roll
                if (!deconActive && nearestDecon !== null && nearestDecon.d <= nearestDecon.r) {
                    deconActive = true;
                    deconFired = false; // fresh entry — effect hasn't fired yet
                } else if (deconActive && (nearestDecon === null || nearestDecon.d > (nearestDecon ? nearestDecon.r : 15) * 1.2)) {
                    deconActive = false;
                    deconFired = false; // left the zone — reset for next entry
                }
                if (deconActive && !deconFired) {
                    deconFired = true;
                    // Shed ALL rads
                    const radsBefore = userProfile.rads || 0;
                    if (radsBefore > 0) adjustRads(-radsBefore);
                    // Mutation strip roll (unless Starched Genes)
                    if (starchedPlayerUnlocked) {
                        showNotification('✦ DECONTAMINATION COMPLETE — RADS SHED. STARCHED GENES HOLD YOUR MUTATIONS.');
                    } else if (activeMutations.length > 0 && Math.random() < 0.5) {
                        const lostId = activeMutations[Math.floor(Math.random() * activeMutations.length)];
                        const lostM = MUTATIONS.find(x => x.id === lostId);
                        loseMutation(lostId);
                        // loseMutation already shows a notification, but let's add decon context
                        // (the loseMutation notification is sufficient)
                    } else {
                        showNotification('✦ DECONTAMINATION COMPLETE — RADS SHED. MUTATIONS HOLD.');
                    }
                }
                renderVaultBoyFx(); // overlays repaint on any engine evaluation
            }
            // Hysteresis: the field GRABS at its radius and RELEASES 20% past it — no boundary
            // flicker. Pariah fields carry no r -> legacy 15/18. v0.48: entry/exit toasts
            // DELETED per user — the geiger counter is the voice of the field now.
            if (!radFieldActive && nearest && nearest.d <= (nearest.r || 15)) {
                radFieldActive = true;
                radFieldPariah = nearest.name;
                radFieldRadius = nearest.r || 15;
            } else if (radFieldActive && (!nearest || nearest.d > radFieldRadius * 1.2)) {
                radFieldActive = false;
                radFieldPariah = null;
            }
        }

        // v0.49: REAL GEIGER VOICE — the field rattle is now the user's 24s geiger loop,
        // shipped inline as geiger.mp3 and precached by the SW (fully offline). Each dose
        // plays a short random SLICE of the loop instead of the whole clip.
        let geigerPool = [];
        let geigerTurn = 0;
        function geigerClick() {
            try {
                if (!geigerPool.length) {
                    for (let i = 0; i < 2; i++) { const a = new Audio('geiger.mp3'); a.preload = 'auto'; geigerPool.push(a); }
                }
                const a = geigerPool[geigerTurn++ % geigerPool.length];
                const durMs = (a.duration && isFinite(a.duration)) ? a.duration * 1000 : 0;
                const slice = 450 + Math.random() * 350; // 0.45–0.80s of crackle per dose
                a.currentTime = (durMs > slice + 200) ? (Math.random() * (durMs - slice)) / 1000 : 0;
                a.volume = 0.9;
                const stopAt = setTimeout(() => { try { a.pause(); } catch (e) {} }, slice);
                a.play().catch(() => { clearTimeout(stopAt); }); // pre-gesture autoplay rejection: silence, never an error
            } catch (e) { /* audio unavailable: silence, never an error */ }
        }
        // A field tick = one crackle slice, with an occasional second piled on top
        function geigerBurst() {
            geigerClick();
            if (Math.random() < 0.25) setTimeout(geigerClick, 120 + Math.random() * 140);
        }

        // v0.48: two clocks. Fields burn FAST (user: "1 every 5 seconds"), recovery stays
        // one rad per quiet minute — and the two still never run at once.
        function radDamageTick() {
            evalPariahField(); // cheap re-evaluation: beacons age even between GPS fixes
            if (!radFieldActive) return;
            // v0.59: Guzzoline Addict — radiation accumulates at half rate (50% skip per tick)
            const guzzolineResist = (userProfile.trait && userProfile.trait.id === 'guzzoline');
            if (guzzolineResist && Math.random() < 0.5) {
                geigerBurst(); // still hear the rattle, just don't absorb the dose
            } else {
                adjustRads(1);
                geigerBurst();
            }
            // v0.58: mutation roll — only when current rads >= 250
            if (userProfile.rads >= 250) rollMutation();
        }
        setInterval(radDamageTick, 5000);
        function radDecayTick() {
            evalPariahField();
            // v0.50: ✚ MED ZONE shelter sheds 5/min; the open waste keeps its 1/min
            if (!radFieldActive) adjustRads(medShelterActive ? -5 : -1);
        }
        setInterval(radDecayTick, 60000);

        // v0.46: the Overseer's pariah decrees (same watch pattern as the mailbox)
        function startPariahListener() {
            window.firebaseOnValue(window.firebaseRef(window.db, 'pariahs/'), (snap) => {
                pariahMarks = snap.val() || {};
                evalPariahField(); // a fresh decree can bathe you where you stand
                if (statsPaneActive()) renderStatsTab(); // v0.53
                if (overseerPaneActive()) renderOverseerTab(); // v0.58
            }, () => {}); // offline: last known decree list stands
        }

        // v0.47: Overseer hot zones (static fields) — they watch the same way
        function startRadZoneListener() {
            window.firebaseOnValue(window.firebaseRef(window.db, 'radzones/'), (snap) => {
                renderRadZones(snap.val() || {});
                evalPariahField(); // a dropped zone can bathe you where you stand
                if (statsPaneActive()) renderStatsTab(); // v0.53
                if (overseerPaneActive()) renderOverseerTab(); // v0.58
            }, () => {}); // offline: last known zone board stands
        }

        // v0.70: Global contracts listener
        function startGlobalContractsListener() {
            window.firebaseOnValue(window.firebaseRef(window.db, 'globalContracts/'), (snap) => {
                globalContracts = snap.val() || {};
                if (document.getElementById('quest-tab-global') && document.getElementById('quest-tab-global').classList.contains('active')) {
                    renderGlobalContracts();
                }
            }, () => {}); // offline: last known contracts stand
        }

        // v0.70: Bounties listener
        function startBountiesListener() {
            window.firebaseOnValue(window.firebaseRef(window.db, 'bounties/'), (snap) => {
                bounties = snap.val() || {};
                if (document.getElementById('quest-tab-bounties') && document.getElementById('quest-tab-bounties').classList.contains('active')) {
                    renderBounties();
                }
            }, () => {}); // offline: last known bounties stand
        }

        // --- OVERSEER PARIAH CONTROL (STATS tab, dev-mode only) ---
        function renderPariahPanel() {
            // v0.56: the Overseer's WIRE DESK rides the top of the panel
            let html = '<h3 style="color:#ffb642; text-shadow:0 0 6px #ffb642; border-bottom:1px dashed #ffb642; padding-bottom:5px;">📣 WIRE DESK</h3>';
            html += '<div class="form-group"><input type="text" id="wire-text" class="pip-input vk-target" readonly onclick="openVk(\'wire-text\')" placeholder="BROADCAST TO EVERY UNIT (140 CHARS MAX)"></div>';
            html += '<button class="pip-btn" onclick="sendWire()" style="width:100%; border-style:dashed; border-color:#ffb642; color:#ffb642; margin-bottom:14px;">[📣 TRANSMIT WIRE]</button>';
            html += '<h2 style="color:#ff3333;">☢ PARIAH WATCH</h2>';
            html += '<p style="font-size:0.95rem; opacity:0.75; line-height:1.4;">MARKED WASTELANDERS RADIATE A 15M FIELD: ANYONE INSIDE TAKES +1 RAD/MIN (ENTRY AT 15M, RELEASE AT 18M). SIGNALS STALE BEYOND 5MIN DO NOT IRRADIATE.</p>';
            const marks = Object.keys(pariahMarks);
            html += '<h3 style="border-bottom:1px dashed var(--pip-color-dim); padding-bottom:5px; margin:15px 0 10px; opacity:0.8;">DECLARED PARIAHS</h3>';
            if (!marks.length) {
                html += '<p style="opacity:0.5;">NO PARIAHS DECLARED.</p>';
            } else {
                marks.forEach(uid => {
                    const name = ((pariahMarks[uid] || {}).name) || uid;
                    html += '<div class="item-row"><div class="item-info"><div style="color:#ff3333;">☢ ' + escapeHtml(name) + '</div><div class="item-effects">DECLARED ' + timeOf((pariahMarks[uid] || {}).ts || Date.now()) + '</div></div><button class="theme-btn" onclick="cleansePariah(\'' + escapeHtml(uid) + '\')">[CLEANSE]</button></div>';
                });
            }
            // Candidate roster: fresh LIVE signals, not already marked, never yourself
            const now = Date.now();
            const cands = Object.keys(lastKnownBeaconData).filter(uid => {
                if (uid === myMailUid || pariahMarks[uid]) return false;
                const b = lastKnownBeaconData[uid];
                return b && b.timestamp && (now - b.timestamp) <= 5 * 60 * 1000;
            });
            html += '<h3 style="border-bottom:1px dashed var(--pip-color-dim); padding-bottom:5px; margin:15px 0 10px; opacity:0.8;">LIVE SIGNALS (5MIN)</h3>';
            if (!cands.length) {
                html += '<p style="opacity:0.5;">NO FRESH SIGNALS ON THE RADAR. OPEN THE MAP ONCE THIS SESSION TO START THE RADAR FEED.</p>';
            } else {
                cands.forEach(uid => {
                    const b = lastKnownBeaconData[uid];
                    html += '<div class="item-row"><div class="item-info"><div>' + escapeHtml(b.name || 'UNKNOWN') + '</div></div><button class="theme-btn" style="color:#ff3333; border-color:#ff3333;" onclick="markPariah(\'' + escapeHtml(uid) + '\')">[MARK PARIAH]</button></div>';
                });
            }
            // v0.47: pre-declare from the rolodex — a decree sits until their beacon next
            // goes fresh (fields only irradiate off live ≤5min signals, so COLD marks
            // are harmless paperwork until the wastelander actually walks in)
            const known = rolodex.filter(c => c.uid && c.uid !== myMailUid && !pariahMarks[c.uid]);
            html += '<h3 style="border-bottom:1px dashed var(--pip-color-dim); padding-bottom:5px; margin:15px 0 10px; opacity:0.8;">KNOWN WASTELANDERS (ROLODEX)</h3>';
            if (!known.length) {
                html += '<p style="opacity:0.5;">NO ELIGIBLE CONTACTS.</p>';
            } else {
                known.forEach(c => {
                    const b = lastKnownBeaconData[c.uid];
                    const cold = !(b && b.timestamp && (now - b.timestamp) <= 5 * 60 * 1000);
                    html += '<div class="item-row"><div class="item-info"><div>' + escapeHtml(c.name || 'UNKNOWN') + (cold ? ' <span style="opacity:0.6;">(COLD)</span>' : '') + '</div></div><button class="theme-btn" style="color:#ff3333; border-color:#ff3333;" onclick="markPariah(\'' + escapeHtml(c.uid) + '\')">[MARK PARIAH]</button></div>';
                });
            }
            // v0.71: Cold wastelanders removal (overseer can clean up stale beacons)
            const coldWastelanders = Object.keys(lastKnownBeaconData).filter(uid => {
                if (uid === myMailUid) return false;
                const b = lastKnownBeaconData[uid];
                return b && b.timestamp && (now - b.timestamp) > 3 * 24 * 60 * 60 * 1000; // older than 3 days
            });
            html += '<h3 style="border-bottom:1px dashed var(--pip-color-dim); padding-bottom:5px; margin:15px 0 10px; opacity:0.8;">COLD WASTELANDERS (>3 DAYS)</h3>';
            if (!coldWastelanders.length) {
                html += '<p style="opacity:0.5;">NO COLD SIGNALS TO REMOVE.</p>';
            } else {
                html += '<p style="font-size:0.85rem; opacity:0.7; margin-bottom:10px;">Remove stale beacons from Firebase to clean up the map.</p>';
                coldWastelanders.forEach(uid => {
                    const b = lastKnownBeaconData[uid];
                    const ageDays = Math.floor((now - b.timestamp) / (24 * 60 * 60 * 1000));
                    html += '<div class="item-row"><div class="item-info"><div>' + escapeHtml(b.name || 'UNKNOWN') + '</div><div class="item-effects">LAST SEEN ' + ageDays + 'D AGO</div></div><button class="theme-btn" style="color:#ff3333; border-color:#ff3333;" onclick="removeColdWastelander(\'' + escapeHtml(uid) + '\')">[REMOVE]</button></div>';
                });
            }
            // v0.47: HOT ZONES — static radiation fields the Overseer drops at a spot.
            // No auto-expiry: they burn until EXTINGUISH (decree-style control).
            html += '<h3 style="border-bottom:1px dashed var(--pip-color-dim); padding-bottom:5px; margin:15px 0 10px; opacity:0.8;">ZONES</h3>'; // v0.55: sizes are pickable now, no longer static-15m
            const zKeys = Object.keys(lastKnownRadZones).sort((a, b) => ((lastKnownRadZones[b] || {}).ts || 0) - ((lastKnownRadZones[a] || {}).ts || 0));
            if (!zKeys.length) {
                html += '<p style="opacity:0.5;">NO ZONES DEPLOYED.</p>';
            } else {
                zKeys.forEach(zk => {
                    const z = lastKnownRadZones[zk] || {};
                    // v0.58: kind-aware zone list (hot / med / decon)
                    const zk2 = z.kind || 'hot';
                    const zColor = zk2 === 'med' ? '#5fc98e' : (zk2 === 'decon' ? '#42d4f5' : '#ff3333');
                    const zGlyph = zk2 === 'med' ? '✚' : (zk2 === 'decon' ? '✦' : '☢');
                    const zLabel = zk2 === 'med' ? 'MED ZONE' : (zk2 === 'decon' ? 'DECON STATION' : 'HOT ZONE');
                    html += '<div class="item-row"><div class="item-info"><div style="color:' + zColor + ';">' + zGlyph + ' ' + escapeHtml(z.label || zLabel) + '</div><div class="item-effects">DEPLOYED ' + timeOf(z.ts || Date.now()) + '</div></div><button class="theme-btn" onclick="extinguishZone(\'' + escapeHtml(zk) + '\')">[EXTINGUISH]</button></div>';
                });
            }
            html += '<div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;"><button class="pip-btn" style="border-color:#ff3333; color:#ff3333; flex:1; margin:0; min-width:120px;" onclick="dropHotZone(\'me\')">[☢ HOT ZONE AT MY POSITION]</button><button class="pip-btn" style="border-color:#5fc98e; color:#5fc98e; flex:1; margin:0; min-width:120px;" onclick="dropMedZone(\'me\')">[✚ MED ZONE AT MY POSITION]</button><button class="pip-btn" style="border-color:#42d4f5; color:#42d4f5; flex:1; margin:0; min-width:120px;" onclick="dropDeconZone(\'me\')">[✦ DECON AT MY POSITION]</button></div>';
            html += '<p style="font-size:0.9rem; opacity:0.7; margin-top:8px; line-height:1.4;">LONG-PRESS THE MAP FOR PLACE-ANYWHERE DROPS (OVERSEER ONLY).</p>';
            // v0.58: Starched Genes global toggle
            html += '<div style="margin-top:20px; border-top:1px dashed #ffb642; padding-top:12px;">';
            html += '<h3 style="color:#ffb642; text-shadow:0 0 6px #ffb642;">🧬 STARCHED GENES</h3>';
            html += '<p style="font-size:0.9rem; opacity:0.75; margin-bottom:8px;">WHEN ENABLED, ALL PLAYERS SEE AN UNLOCK BUTTON IN THEIR STATS PANEL. ONCE UNLOCKED, DECON STATIONS CANNOT STRIP THEIR MUTATIONS.</p>';
            html += '<button class="pip-btn" onclick="toggleStarchedGlobal()" style="border-color:#ffb642; color:#ffb642; border-style:dashed;">[STARCHED GENES: ' + (starchedGloballyUnlocked ? 'ENABLED' : 'DISABLED') + ']</button>';
            html += '</div>';
            return html;
        }

        // v0.50: generic zone writer — both kinds, placed anywhere by map long-press
        // ('map') or at the Overseer's boots ('me'). v0.55: the Overseer picks the fence
        // radius at drop time (the rules validator has allowed 5..200 since v0.50).
        // Fences are REAL metre radii: L.circle scales with zoom and matches ground truth.
        function dropZone(kind, lat, lng, radius) {
            if (!window.db || navigator.onLine === false) { showNotification('NO SIGNAL -- ZONE NOT TRANSMITTED.'); return; }
            const r = (typeof radius === 'number' && radius >= 5 && radius <= 200) ? radius : 15;
            const key = 'z' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
            const zone = {
                label: kind === 'med' ? 'MED ZONE' : (kind === 'decon' ? 'DECON STATION' : 'HOT ZONE'),
                kind: kind, lat: lat, lng: lng, radius: r, ts: Date.now()
            };
            // v0.57: close the add-marker modal after deployment (was staying open); no ack toast needed
            closeModals();
            window.firebaseSet(window.firebaseRef(window.db, 'radzones/' + key), zone)
                .catch(() => showNotification('DEPLOY FAILED -- CHECK SIGNAL OR RULES.'));
        }

        // v0.58: themed radius STEPPER — replaces the old chip picker.
        // Tap ±1/±5/±25 to dial any fence 5–200M, DEPLOY commits.
        let _zoneStepperVal = 50;
        function cpStepVal(delta) {
            _zoneStepperVal = Math.max(5, Math.min(200, _zoneStepperVal + delta));
            const el = document.getElementById('cp-stepper-val');
            if (el) el.innerText = _zoneStepperVal + 'M';
            // Update the DEPLOY button label live
            const deployBtn = document.getElementById('cp-deploy-btn');
            if (deployBtn) deployBtn.innerText = 'DEPLOY ' + _zoneStepperVal + 'M FENCE';
        }
        function promptZoneRadius(kind, where) {
            if (where === 'me' && (myLastLat === null || myLastLng === null)) { showNotification('NO POSITION FIX -- ENABLE GPS TRACKING FROM THE MAP TAB.'); return; }
            const lat = where === 'map' ? tempWpLat : myLastLat;
            const lng = where === 'map' ? tempWpLng : myLastLng;
            const med = kind === 'med';
            const tint = med ? '#5fc98e' : '#ff3333';
            _zoneStepperVal = 50; // default
            const stepperHtml = '<div id="cp-stepper" style="display:flex; align-items:center; justify-content:center; gap:6px; margin:15px 0; flex-wrap:wrap;">' +
                '<button class="theme-btn" onclick="cpStepVal(-25)" style="padding:4px 8px;">−25</button>' +
                '<button class="theme-btn" onclick="cpStepVal(-5)" style="padding:4px 8px;">−5</button>' +
                '<button class="theme-btn" onclick="cpStepVal(-1)" style="padding:4px 8px;">−1</button>' +
                '<span id="cp-stepper-val" style="font-size:1.8rem; font-weight:bold; min-width:70px; text-align:center; color:' + tint + '; text-shadow:0 0 6px ' + tint + ';">50M</span>' +
                '<button class="theme-btn" onclick="cpStepVal(1)" style="padding:4px 8px;">+1</button>' +
                '<button class="theme-btn" onclick="cpStepVal(5)" style="padding:4px 8px;">+5</button>' +
                '<button class="theme-btn" onclick="cpStepVal(25)" style="padding:4px 8px;">+25</button>' +
                '</div>';
            showCustomPrompt(
                (med ? 'SANCTIFY' : 'IRRADIATE') + ' THIS SPOT — SET FENCE RADIUS (5–200M):',
                [
                    { label: 'DEPLOY 50M FENCE', color: tint, action: () => {
                        dropZone(kind, lat, lng, Math.max(5, Math.min(200, _zoneStepperVal)));
                    }},
                    { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
                ]
            );
            // Inject stepper HTML into the prompt text area (overrides innerText with innerHTML)
            const cpText = document.getElementById('cp-text');
            if (cpText) cpText.innerHTML = (med ? 'SANCTIFY' : 'IRRADIATE') + ' THIS SPOT — SET FENCE RADIUS (5–200M):' + stepperHtml;
            // Tag the deploy button with an ID so the stepper can update its label live
            const btns = document.getElementById('cp-buttons');
            if (btns && btns.firstChild) btns.firstChild.id = 'cp-deploy-btn';
        }

        function dropHotZone(where) { promptZoneRadius('hot', where); } // v0.55: sized drops

        // v0.50: the healing counterpart — −5 rads/min inside instead of the wasteland's 1
        function dropMedZone(where) { promptZoneRadius('med', where); } // v0.55: sized drops

        // v0.58: decontamination station — fixed 15m, sheds ALL rads + mutation strip roll on entry
        function dropDeconZone(where) {
            if (where === 'map') {
                if (tempWpLat === null || tempWpLng === null) { showNotification('NO POSITION SELECTED.'); return; }
                showCustomPrompt('DEPLOY DECONTAMINATION STATION HERE? FIXED 15M RADIUS. SHEDS ALL RADS + 50% MUTATION STRIP ON ENTRY.', [
                    { label: 'DEPLOY', color: '#42d4f5', action: () => { dropZone('decon', tempWpLat, tempWpLng, 15); } },
                    { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
                ]);
            } else {
                dropZone('decon', myLastLat, myLastLng, 15);
            }
        }

        // v0.51: reachable from the STATS panel AND the map zone card; copy is
        // kind-aware (it always said HOT ZONE before, even for ✚ MED zones).
        function extinguishZone(key) {
            if (!window.db || navigator.onLine === false) { showNotification('NO SIGNAL -- ORDER NOT TRANSMITTED.'); return; }
            const z = lastKnownRadZones[key];
            const noun = (z && z.kind === 'med') ? 'MED ZONE' : ((z && z.kind === 'decon') ? 'DECON STATION' : 'HOT ZONE');
            showCustomPrompt('EXTINGUISH THIS ' + noun + '? ITS FIELD DIES IMMEDIATELY FOR ALL UNITS.', [
                { label: 'EXTINGUISH', action: () => {
                    window.firebaseRemove(window.firebaseRef(window.db, 'radzones/' + key))
                        .then(() => {
                            showNotification(noun + ' EXTINGUISHED.');
                            if (selectedZoneKey === key) deselectZone(); // v0.51: clear the pinned card
                        })
                        .catch(() => showNotification('ORDER FAILED -- CHECK SIGNAL.'));
                }},
                { label: 'CANCEL', color: 'var(--pip-color-dim)' }
            ]);
        }

        function markPariah(uid) {
            if (!window.db || navigator.onLine === false) { showNotification('NO SIGNAL -- DECREE NOT TRANSMITTED.'); return; }
            // v0.47: rolodex pre-declares arrive with no live beacon — fall back to the contact name
            const name = String(((lastKnownBeaconData[uid] || {}).name) || ((contactByUid(uid) || {}).name) || 'UNKNOWN').toUpperCase().substring(0, 32);
            showCustomPrompt('DECLARE ' + name + ' A PARIAH? EVERY UNIT WITHIN 15M TAKES RADS UNTIL CLEANSED.', [
                { label: 'MARK PARIAH', color: '#ff3333', action: () => {
                    window.firebaseSet(window.firebaseRef(window.db, 'pariahs/' + uid), { name: name, ts: Date.now() })
                        .then(() => showNotification('PARIAH DECLARED: ' + name))
                        .catch(() => showNotification('DECREE FAILED -- CHECK SIGNAL.'));
                }},
                { label: 'CANCEL', color: 'var(--pip-color-dim)' }
            ]);
        }

        function cleansePariah(uid) {
            if (!window.db || navigator.onLine === false) { showNotification('NO SIGNAL -- CLEANSE NOT TRANSMITTED.'); return; }
            const name = String(((pariahMarks[uid] || {}).name) || uid).toUpperCase();
            showCustomPrompt('CLEANSE ' + name + '? THEIR RADIATION FIELD DIES IMMEDIATELY FOR ALL UNITS.', [
                { label: 'CLEANSE', action: () => {
                    window.firebaseRemove(window.firebaseRef(window.db, 'pariahs/' + uid))
                        .then(() => showNotification('PARIAH CLEANSED: ' + name))
                        .catch(() => showNotification('CLEANSE FAILED -- CHECK SIGNAL.'));
                }},
                { label: 'CANCEL', color: 'var(--pip-color-dim)' }
            ]);
        }

        // v0.71: Remove cold wastelander from Firebase (overseer cleanup)
        function removeColdWastelander(uid) {
            if (!window.db || navigator.onLine === false) { showNotification('NO SIGNAL -- REMOVE NOT TRANSMITTED.'); return; }
            const b = lastKnownBeaconData[uid];
            const name = (b && b.name) ? b.name.toUpperCase() : 'UNKNOWN';
            showCustomPrompt('REMOVE ' + name + ' FROM MAP? THEIR BEACON WILL BE DELETED FROM FIREBASE.', [
                { label: 'REMOVE', color: '#ff3333', action: () => {
                    window.firebaseRemove(window.firebaseRef(window.db, 'wastelanders/' + uid))
                        .then(() => {
                            showNotification('WASTELANDER REMOVED: ' + name);
                            // Refresh the overseer panel
                            if (overseerPaneActive()) renderOverseerTab();
                        })
                        .catch(() => showNotification('REMOVE FAILED -- CHECK SIGNAL.'));
                }},
                { label: 'CANCEL', color: 'var(--pip-color-dim)' }
            ]);
        }

        function processInboxSnapshot(data) {
            let changedSeen = false;
            inboxLetters = {};
            const stillUnverified = {};
            for (let key in data) {
                const l = data[key];
                if (!l || !l.type) continue;
                if (mailProcessed.indexOf(key) !== -1) {
                    // Housekeeping: letters we already consumed that the sender never cleared
                    // are purged after 2 hours so mailboxes don't accrete forever.
                    if ((l.claimed || l.declined) && l.ts && (Date.now() - l.ts) > 2 * 3600 * 1000) retireLetter(key);
                    continue;
                }
                if (l.type === 'handshake') {
                    if (isContact(l.from)) {
                        // Link already mutual: retire the letter silently
                        if (linkScans[key]) { delete linkScans[key]; changedSeen = true; } // v0.45: parked scan resolved elsewhere
                        retireLetter(key);
                        continue;
                    }
                    if (mailSeen.indexOf(key) === -1) {
                        mailSeen.push(key); changedSeen = true;
                        // v0.45: NOTIFY LINKS off = no pop-up; the scan parks as a MAIL
                        // tab row and waits for YOU to tap it
                        if (!notifyPref('link')) { linkScans[key] = l; continue; }
                        showCustomPrompt((l.fromName || 'UNKNOWN') + ' HAS SCANNED YOUR DATACARD. ADD THEM TO WASTELANDERS MET?', [
                            {
                                label: 'ACCEPT LINK',
                                action: () => {
                                    addContact(safeUid(l.from), (l.fromName || 'UNKNOWN').toUpperCase());
                                    retireLetter(key);
                                    if (currentDataTab === 'wastelanders') { renderWastelanders(); renderLinkRequests(); }
                                }
                            },
                            { label: 'IGNORE', color: 'var(--pip-color-dim)', action: () => { retireLetter(key); } }
                        ]);
                    }
                    continue; // handshakes are prompts, never inbox rows
                }
                if (isContact(l.from)) {
                    inboxLetters[key] = l;
                    if (mailSeen.indexOf(key) === -1) {
                        mailSeen.push(key); changedSeen = true;
                        // v0.45: NOTIFY MESSAGES gates both the toast and the OS ping
                        if (notifyPref('msg')) {
                            showNotification('INCOMING TRANSMISSION — ' + (l.fromName || 'UNKNOWN') + ': ' + typeSummary(l));
                            mailPingOs('NEW TRANSMISSION FROM ' + (l.fromName || 'UNKNOWN') + ' -- ' + typeSummary(l));
                        }
                        // v0.48: inbound photos no longer raid the CAM databank — they open
                        // right here in mail (prompt + feed thumbs); the mailbox is their home.
                    }
                } else {
                    stillUnverified[key] = l;
                    if (mailSeen.indexOf(key) === -1) {
                        mailSeen.push(key); changedSeen = true;
                        // v0.45: NOTIFY MESSAGES gates the quarantine hold alert too
                        if (notifyPref('msg')) {
                            showNotification('UNTRUSTED TRANSMISSION HELD IN MAIL QUARANTINE. SCAN THEIR DATACARD TO UNLOCK.');
                            mailPingOs('UNTRUSTED TRANSMISSION HELD IN MAIL QUARANTINE.');
                        }
                    }
                }
            }
            unverifiedLetters = stillUnverified;
            if (mailSeen.length > 500) mailSeen = mailSeen.slice(-500);
            if (changedSeen) saveComms();
            renderMailBadge();
            if (mailTabActive()) renderMail();
        }

        function retireLetter(key) {
            if (!window.db) return;
            window.firebaseRemove(window.firebaseRef(window.db, 'mail/' + myMailUid + '/' + key)).catch(() => {});
        }
        function flagLetter(key, field) {
            if (!window.db) return;
            window.firebaseSet(window.firebaseRef(window.db, 'mail/' + myMailUid + '/' + key + '/' + field), true).catch(() => {});
        }
        function markProcessed(key) {
            mailProcessed.push(key);
            if (mailProcessed.length > 500) mailProcessed = mailProcessed.slice(-500);
            saveProcessed();
            delete inboxLetters[key];
            delete unverifiedLetters[key]; // also consume letters opened via the untrusted gate
            renderMailBadge(); // v0.48: badge repaints the INSTANT a letter resolves — before this it waited (visibly) on the next Firebase snapshot
        }

        function typeSummary(l) {
            if (l.type === 'quest') return 'QUEST: ' + (l.payload && l.payload.title ? l.payload.title : '');
            if (l.type === 'item') return 'ITEM: ' + (l.payload && l.payload.name ? l.payload.name : '') + ' x' + (l.payload && l.payload.quantity ? l.payload.quantity : 1);
            // v0.47: message letters can carry attachments — say so on the ACTION row
            if (l.type === 'msg' && l.payload && (l.payload.photo || l.payload.item)) {
                return 'MESSAGE:' + (l.payload.photo ? ' 📷' : '') + (l.payload.item ? ' 🎒 ' + l.payload.item.name : '');
            }
            return 'MESSAGE';
        }

        // v0.34: untrusted transmissions can be opened on demand (with a warning gate first)
        function openUntrusted(key) {
            const l = unverifiedLetters[key];
            if (!l) return;
            showCustomPrompt('UNTRUSTED ' + (l.type || '???').toUpperCase() + ' FROM "' + (l.fromName || 'UNKNOWN') + '". THIS FREQUENCY IS NOT LINKED HOW DO YOU PROCEED?', [
                {
                    label: 'OPEN ANYWAY (STAY UNLINKED)',
                    action: () => openMailItem(key, 'unverified')
                },
                {
                    label: 'TRUST SENDER (LINK)',
                    action: () => {
                        addContact(safeUid(l.from), (l.fromName || 'UNKNOWN').toUpperCase());
                        if (mailTabActive()) renderMail();
                    }
                },
                { label: 'IGNORE', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        // v0.45: a PARKED link scan (NOTIFY LINKS off) is the same decision, on YOUR schedule
        function openLinkScan(key) {
            const l = linkScans[key];
            if (!l) return;
            const settle = () => {
                delete linkScans[key];
                saveComms();
                retireLetter(key);
                renderMailBadge();
                if (mailTabActive()) renderMail();
            };
            showCustomPrompt((l.fromName || 'UNKNOWN') + ' HAS SCANNED YOUR DATACARD. ADD THEM TO WASTELANDERS MET?', [
                {
                    label: 'ACCEPT LINK',
                    action: () => {
                        addContact(safeUid(l.from), (l.fromName || 'UNKNOWN').toUpperCase());
                        settle();
                        if (currentDataTab === 'wastelanders') { renderWastelanders(); renderLinkRequests(); }
                    }
                },
                { label: 'IGNORE', color: 'var(--pip-color-dim)', action: settle }
            ]);
        }

        function openMailItem(key, src) {
            const l = (src === 'unverified') ? unverifiedLetters[key] : inboxLetters[key];
            if (!l) return;
            const from = (l.fromName || 'UNKNOWN');
            if (l.type === 'msg') {
                // v0.44: fulfil notices get their own flow (option to complete YOUR copy too)
                if (l.payload && l.payload.fulfilledTitle) { openFulfilNotice(key, l, src); return; }
                // v0.47: ONE combined branch — plain text, text+photo, text+item, or all.
                // Attached photos show right in the prompt; attached items grant on LOG.
                const p = l.payload || {};
                if (!p.photo && !p.item) {
                    showCustomPrompt('MESSAGE FROM ' + from + ': "' + (p.text || '') + '"', [
                        { label: 'LOG TRANSMISSION', action: () => acceptMsg(key, l) },
                        { label: 'REPLY', action: () => composeTo('msg', safeUid(l.from), key) },
                        { label: 'DELETE', color: '#ff3333', action: () => declineLetter(key) }
                    ]);
                    return;
                }
                const bits = [];
                if (p.photo) bits.push('PHOTO ATTACHED — VIEW IT HERE; IT STAYS IN THIS MAIL THREAD'); // v0.48: mail-native photos, no databank raid
                if (p.item) bits.push('ITEM ATTACHED: ' + p.item.name + ' x' + (p.item.quantity || 1) + ' — TAKE IT TO CLAIM');
                const body = (p.text && p.text !== '📷 PHOTO TRANSMISSION')
                    ? 'MESSAGE FROM ' + from + ': "' + p.text + '"'
                    : from + ' SENT A PHOTO TRANSMISSION.';
                const msgBtns = [
                    { label: p.item ? 'LOG + TAKE ITEM' : 'LOG TRANSMISSION', action: () => acceptMsg(key, l) },
                    { label: 'REPLY', action: () => composeTo('msg', safeUid(l.from), key) },
                ];
                if (p.photo) msgBtns.push({ label: 'SAVE PHOTO', action: () => saveMailPhoto(p.photo) }); // v0.56
                msgBtns.push({ label: 'DELETE', color: '#ff3333', action: () => declineLetter(key) });
                showCustomPrompt(body + '\n\n' + bits.join('\n'), msgBtns);
                if (p.photo) {
                    const img = document.getElementById('cp-img');
                    if (img) { img.src = p.photo; img.style.display = 'block'; } // full transit copy, pre-log
                }
            } else if (l.type === 'quest') {
                const p = l.payload || {};
                showCustomPrompt('QUEST FROM ' + from + ': "' + (p.title || '') + '"' + (p.brief ? ' — ' + p.brief : '') + ' — OBJ: ' + ((p.objectives || []).join(' / ') || 'NONE') + (p.reward ? ' — REWARD: ' + p.reward : ''), [
                    { label: 'ACCEPT CONTRACT', action: () => acceptQuest(key, l) },
                    { label: 'DECLINE', color: '#ff3333', action: () => declineLetter(key) }
                ]);
            } else if (l.type === 'item') {
                const p = l.payload || {};
                showCustomPrompt('ITEM FROM ' + from + ': ' + (p.name || 'UNKNOWN') + ' x' + (p.quantity || 1) + '. ADD TO INVENTORY?', [
                    { label: 'TAKE ITEM', action: () => acceptItem(key, l) },
                    { label: 'DECLINE', color: '#ff3333', action: () => declineLetter(key) }
                ]);
            }
        }

        // v0.45: compact log-copy thumbs so PHOTO TRANSMISSIONS stay viewable from the
        // feed (full-size received copies still land in the CAM databank via auto-save)
        function makeMailThumb(dataURI, cb) {
            const img = new Image();
            img.onload = () => {
                try {
                    const s = Math.min(1, 480 / Math.max(img.width, img.height));
                    const cv = document.createElement('canvas');
                    cv.width = Math.max(1, Math.floor(img.width * s));
                    cv.height = Math.max(1, Math.floor(img.height * s));
                    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                    cb(cv.toDataURL('image/jpeg', 0.45));
                } catch (e) { cb(null); }
            };
            img.onerror = () => cb(null);
            img.src = dataURI;
        }

        // Storage guard: image data rides the newest 20 photo log entries only; older
        // rows degrade to text + 📷 flag (same DATABANK-PRESSURE philosophy as the cam archive)
        function pruneMailPhotos() {
            let kept = 0;
            mailLog.forEach(m => {
                if (m.photo) { kept++; if (kept > 20) delete m.photo; }
            });
        }

        function acceptMsg(key, l) {
            // v0.48: photos live IN MAIL now — no databank auto-save on log either
            // v0.47: attached item pods grant straight into the LOADOUT on log
            if (l.payload && l.payload.item) {
                refundItemPayload(l.payload.item);
                showNotification('ITEM SECURED: ' + (l.payload.item.name || 'UNKNOWN'));
            }
            const logEntry = {
                dir: 'in', uid: safeUid(l.from), name: (l.fromName || 'UNKNOWN'),
                text: (l.payload.text || (l.payload && l.payload.photo ? '📷 PHOTO TRANSMISSION' : '')),
                ts: l.ts || Date.now(),
                hasPhoto: !!(l.payload && l.payload.photo),
                fulfilledTitle: (l.payload && l.payload.fulfilledTitle) || null
            };
            mailLog.unshift(logEntry);
            if (mailLog.length > 100) mailLog.pop();
            // v0.45: small thumb copy so the received photo opens from the feed
            if (logEntry.hasPhoto) makeMailThumb(l.payload.photo, thumb => {
                if (!thumb || mailLog.indexOf(logEntry) === -1) return;
                logEntry.photo = thumb;
                pruneMailPhotos();
                saveComms();
                if (mailTabActive()) renderMail();
            });
            flagLetter(key, 'claimed');
            markProcessed(key);
            saveComms();
            showNotification('TRANSMISSION LOGGED.');
            if (mailTabActive()) renderMail();
            setTimeout(() => { if (mailTabActive()) renderMail(); }, 50); // v0.61: delayed re-render to ensure UI updates
        }

        // v0.48: photo auto-save to the CAM databank is GONE (user: "open received image in
        // mail — don't auto save to databank"). autoSaveMailPhoto deleted; the stale
        // pipboy-photosaved key is left in storage harmlessly.

        // v0.44 item-12: giver opens a fulfil notice -> if THEY also hold an open copy of
        // the same contract (shared/co-op quest, not merely delegated), offer to complete
        // their copy in the same breath
        function openFulfilNotice(key, l, src) {
            const from = (l.fromName || 'UNKNOWN');
            const title = String((l.payload && l.payload.fulfilledTitle) || 'UNNAMED CONTRACT').toUpperCase();
            const myCopy = quests.find(q => q.name === title && !q.completed);
            const buttons = [];
            if (myCopy) {
                buttons.push({ label: 'MARK MY COPY COMPLETE', action: () => {
                    myCopy.completed = true;
                    saveToStorage();
                    renderQuests();
                    showNotification('YOUR COPY MARKED COMPLETE: ' + title);
                    acceptMsg(key, l);
                }});
            }
            buttons.push({ label: 'NOTED', action: () => acceptMsg(key, l) });
            showCustomPrompt(from + ' REPORTS CONTRACT FULFILLED: "' + title + '".' + (myCopy ? ' YOU HOLD AN OPEN COPY OF THIS CONTRACT.' : ''), buttons);
        }

        function acceptQuest(key, l) {
            const p = l.payload || {};
            const objectives = [];
            if (p.brief) objectives.push('BRIEF: ' + p.brief);
            (p.objectives || []).forEach(o => objectives.push(o));
            if (p.reward) objectives.push('REWARD: ' + p.reward);
            if (!objectives.length) objectives.push('Completion terms: see contract giver.');
            quests.push({
                id: Date.now(),
                name: (p.title || 'UNNAMED CONTRACT').toUpperCase(),
                type: 'CONTRACT',
                giver: (l.fromName || 'UNKNOWN').toUpperCase(),
                location: (p.location || 'P2P LINK'),
                timeStr: p.timeStr || '--:--',
                expireTime: p.expireTime || null,
                objectives: objectives,
                completed: false, expired: false, abandoned: false,
                contractKey: key, contractGiver: l.from
            });
            flagLetter(key, 'claimed');
            markProcessed(key);
            saveToStorage();
            renderQuests();
            showNotification('CONTRACT ACCEPTED: ' + (p.title || '').toUpperCase());
            if (mailTabActive()) renderMail();
        }

        function acceptItem(key, l) {
            const p = l.payload || {};
            refundItemPayload(p);
            flagLetter(key, 'claimed');
            markProcessed(key);
            showNotification('ITEM SECURED: ' + (p.name || 'UNKNOWN') + ' x' + (p.quantity || 1));
            if (mailTabActive()) renderMail();
        }

        function declineLetter(key) {
            flagLetter(key, 'declined');
            markProcessed(key);
            if (mailTabActive()) renderMail();
        }

        // --- RENDERERS: badge / rolodex / mail ---
        function renderMailBadge() {
            const el = document.getElementById('mail-navitem'); // v0.53: badge rides the top-level MAIL tab
            if (!el) return;
            const n = Object.keys(inboxLetters).length;
            const u = Object.keys(unverifiedLetters).length;
            const k = Object.keys(linkScans).length; // v0.45: parked link requests count too
            const counts = (n ? ' (' + n + ')' : '') + (u ? ' (' + u + '?)' : '') + (k ? ' (' + k + ' LINK' + (k > 1 ? 'S' : '') + ')' : '');
            // v0.55: pulsing amber envelope when anything waits; plain text when quiet
            if (n + u + k > 0) el.innerHTML = '<span class="mail-pip">✉</span> MAIL' + counts;
            else el.innerText = 'MAIL';
            // v0.55: home-screen icon badge mirrors the waiting count (installed PWAs)
            try { if ('setAppBadge' in navigator) { if (n + u + k > 0) navigator.setAppBadge(n + u + k).catch(() => {}); else navigator.clearAppBadge().catch(() => {}); } } catch (e) {}
        }

        function renderWastelanders() {
            const el = document.getElementById('wastelanders-list');
            if (!el) return;
            if (!rolodex.length) {
                el.innerHTML = '<p style="text-align:center; opacity:0.5;">NO CONTACTS YET. SCAN A WASTELANDER\'S DATACARD.</p>';
                return;
            }
            el.innerHTML = '';
            // v0.63: add bulk remove stale button if any contacts are stale (>7 days)
            const staleThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
            const now = Date.now();
            const staleCount = rolodex.filter(c => {
                const b2 = lastKnownBeaconData[c.uid];
                return !b2 || !b2.timestamp || (now - b2.timestamp) > staleThreshold;
            }).length;
            if (staleCount > 0) {
                const btn = document.createElement('button');
                btn.className = 'pip-btn';
                btn.style.cssText = 'border-color: #ff3333; color: #ff3333; margin-bottom: 15px;';
                btn.innerText = '[REMOVE ' + staleCount + ' STALE CONTACT' + (staleCount > 1 ? 'S' : '') + ']';
                btn.onclick = () => removeStaleWastelanders(staleThreshold);
                el.appendChild(btn);
            }
            [...rolodex].sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(c => {
                const b2 = lastKnownBeaconData[c.uid];
                let presence = 'SIGNAL UNKNOWN';
                let isStale = false;
                if (b2 && b2.timestamp) {
                    const m = Math.floor((now - b2.timestamp) / 60000);
                    const isStaleCheck = (now - b2.timestamp) > staleThreshold;
                    if (isStaleCheck) {
                        presence = 'STALE SIGNAL (' + Math.floor(m / 60 / 24) + 'D AGO)';
                        isStale = true;
                    } else {
                        presence = m < 5 ? 'LIVE SIGNAL' : ('LKL ' + m + 'M AGO');
                    }
                    // v0.51 LINK TELEMETRY: contacts broadcast hp/rads with their fix; the
                    // roster line carries them with the signal's own staleness tag.
                    if (typeof b2.hp === 'number' && typeof b2.rads === 'number') {
                        presence += ' | HP ' + b2.hp + ' | ' + b2.rads + ' RADS' + (m < 5 ? '' : ' (AT LAST SEEN)');
                    }
                } else {
                    isStale = true;
                }
                const row = document.createElement('div');
                row.className = 'item-row';
                row.style.opacity = isStale ? '0.6' : '1';
                row.innerHTML = '<div class="item-info"><div>' + escapeHtml(c.name) + (isStale ? ' <span style="color:#ff3333;">[STALE]</span>' : '') + '</div><div class="item-effects">' + presence + '</div></div><button class="theme-btn" style="border-color: #ff3333; color: #ff3333;" onclick="event.stopPropagation(); forgetWastelander(\'' + safeUid(c.uid) + '\')">[FORGET]</button>';
                row.onclick = () => openContactSheet(c.uid);
                el.appendChild(row);
            });
        }

        // v0.63: bulk remove stale wastelanders (>7 days not seen)
        function removeStaleWastelanders(threshold) {
            const now = Date.now();
            const stale = rolodex.filter(c => {
                const b2 = lastKnownBeaconData[c.uid];
                return !b2 || !b2.timestamp || (now - b2.timestamp) > threshold;
            });
            showCustomPrompt('REMOVE ' + stale.length + ' STALE CONTACT' + (stale.length > 1 ? 'S' : '') + '? THESE WASTELANDERS HAVE NOT BEEN SEEN IN 7+ DAYS.', [
                { label: 'REMOVE ALL STALE', color: '#ff3333', action: () => {
                    stale.forEach(c => {
                        const idx = rolodex.findIndex(r => r.uid === c.uid);
                        if (idx !== -1) rolodex.splice(idx, 1);
                    });
                    saveToStorage();
                    renderWastelanders();
                    showNotification(stale.length + ' STALE CONTACT' + (stale.length > 1 ? 'S' : '') + ' REMOVED.');
                }},
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        function openContactSheet(uid) {
            const c = contactByUid(uid);
            if (!c) return;
            contactUidTarget = uid;
            document.getElementById('contact-name').innerText = c.name;
            const b = lastKnownBeaconData[uid];
            let presence = 'SIGNAL UNKNOWN';
            if (b && b.timestamp) {
                const m = Math.floor((Date.now() - b.timestamp) / 60000);
                presence = m < 5 ? 'LIVE SIGNAL' : ('LAST SEEN ' + m + 'M AGO');
            }
            document.getElementById('contact-meta').innerText = 'MET: ' + new Date(c.metAt).toLocaleDateString() + ' | ' + presence;
            // v0.52: vitals bar when this contact is broadcasting telemetry (v0.51+ units)
            const cv = document.getElementById('contact-vitals');
            if (cv) {
                if (b && typeof b.hp === 'number' && typeof b.rads === 'number') {
                    cv.innerHTML = vitalsBarHtml(b.hp, b.rads);
                    cv.style.display = 'block';
                } else {
                    cv.innerHTML = '';
                    cv.style.display = 'none';
                }
            }
            document.getElementById('contact-modal').style.display = 'flex';
        }

        // v0.35: shared FORGET flow (per-row button + contact sheet) with prompt confirmation
        function forgetWastelander(uid) {
            const c = contactByUid(uid);
            if (!c) return;
            showCustomPrompt('FORGET ' + c.name + '? THEY WILL BE REMOVED FROM WASTELANDERS MET AND FUTURE TRANSMISSIONS WILL BE QUARANTINED.', [
                {
                    label: 'YES, FORGET THEM',
                    color: '#ff3333',
                    action: () => {
                        rolodex = rolodex.filter(x => x.uid !== uid);
                        saveComms();
                        closeModals();
                        renderWastelanders();
                        renderMailBadge();
                        if (statsPaneActive()) renderStatsTab(); // v0.53
                    }
                },
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        function removeActiveContact() {
            if (!contactByUid(contactUidTarget)) return closeModals();
            forgetWastelander(contactUidTarget);
        }

        // --- CONTRACTS TAB (v0.44 item-11): every quest you've ISSUED, live status ---
        // Data source is the existing outbox -- zero new storage, zero Firebase changes.
        function renderContracts() {
            const el = document.getElementById('contracts-list');
            if (!el) return;
            // v0.55: [+ ISSUE NEW QUEST] rides the contracts desk (Overseer-only)
            const issueBtn = (localStorage.getItem('pipboy-dev-mode') === 'true')
                ? '<button class="pip-btn" onclick="issueQuestStart()" style="width: 100%; border-style: dashed; margin-bottom: 10px;">[☢ + ISSUE NEW QUEST]</button>'
                : '';
            const given = outbox.filter(e => e.type === 'quest');
            if (!given.length) {
                el.innerHTML = issueBtn + '<p style="opacity:0.5;">NO CONTRACTS ISSUED. SEND A QUEST TO START ONE.</p>';
                return;
            }
            el.innerHTML = issueBtn;
            [...given].reverse().forEach(e => {
                const c = contactByUid(e.to);
                const terminal = (e.status === 'accepted' || e.status === 'declined' || e.status === 'fulfilled' || e.status === 'closed');
                const clearable = terminal || e.status === 'queued';
                const cancellable = (e.status === 'sent' || e.status === 'awaiting' || e.status === 'sending');
                const row = document.createElement('div');
                row.className = 'item-row';
                row.style.cursor = 'default';
                let actions = '';
                if (cancellable) actions += '<button class="theme-btn" style="border-color:#ff3333; color:#ff3333;" onclick="cancelIssuedQuest(\'' + e.id + '\')">[CANCEL]</button>';
                if (clearable) actions += '<button class="theme-btn" onclick="clearOutboxEntry(\'' + e.id + '\'); renderContracts();">[X]</button>';
                row.innerHTML = '<div class="item-info"><div>' + escapeHtml(e.summary) + '</div><div class="item-effects">→ ' + escapeHtml(c ? c.name : e.to) + ' — ' + escapeHtml(statusLabel(e)) + ' — ' + timeOf(e.ts) + '</div></div>' + actions;
                el.appendChild(row);
            });
        }

        // v0.60: cancel an issued quest (withdraw from outbox + delete Firebase letter)
        function cancelIssuedQuest(id) {
            const e = outbox.find(x => x.id === id);
            if (!e) return;
            const c = contactByUid(e.to);
            showCustomPrompt('CANCEL ISSUED QUEST "' + escapeHtml(e.summary) + '" TO ' + escapeHtml(c ? c.name : e.to) + '? THE RECIPIENT\'S COPY WILL BE DELETED.', [
                { label: 'CANCEL QUEST', color: '#ff3333', action: () => {
                    clearOutboxEntry(id);
                    renderContracts();
                    showNotification('QUEST CANCELLED.');
                }},
                { label: 'KEEP IT', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        // --- PHOTO MAIL (v0.44 items 1/2): two-way confirmed links only ---
        // Gate: allowed unless YOUR handshake to them is verifiably still unanswered
        // (accepted = true; an outstanding sent/queued = blocked; offline-established
        // legacy links pass rather than punishing offline players).
        function isMutualLink(uid) {
            if (!contactByUid(uid)) return false;
            const links = outbox.filter(e => e.type === 'handshake' && e.to === uid);
            if (links.some(e => e.status === 'accepted')) return true;
            if (links.some(e => e.status === 'sent' || e.status === 'queued' || e.status === 'sending')) return false;
            return true;
        }

        let photoPickTarget = null;
        let photoPickMode = 'send'; // v0.47: 'send' = one-shot photo letter; 'attach' = hand the shot back to the message composer
        function openPhotoPicker(uid) {
            const c = contactByUid(uid);
            if (!c) return;
            if (!isMutualLink(uid)) { showNotification('LINK NOT CONFIRMED BOTH WAYS YET -- THEY MUST ACCEPT YOUR DATACARD.'); return; }
            if (!photoArchive.length) { showNotification('DATABANK EMPTY -- TAKE A PHOTO FIRST.'); return; }
            photoPickMode = 'send';
            photoPickTarget = uid;
            document.getElementById('pp-title').innerText = 'TRANSMIT PHOTO TO: ' + c.name;
            let html = '<div class="photo-tile-grid">';
            photoArchive.forEach((e, i) => { html += `<div class="photo-tile" onclick="pickPhotoForMail(${i})"><img src="${entryPip(e)}"></div>`; });
            document.getElementById('pp-grid').innerHTML = html + '</div>';
            document.getElementById('photo-pick-modal').style.display = 'flex';
        }

        // ================= VAULT-BOY GRAPHIC + STATUS OVERLAYS (v0.50) =================
        // The STATUS graphic is a 96px square crop of any shot in YOUR databank.
        // Overlays are pure CSS, drawn from engine state: ☢ in a rad field, ✚ in a
        // MED zone, messy static border at 250+ rads. Zero shipped art.
        function openAvatarPicker() {
            const hasImg = !!localStorage.getItem('pipboy-avatarimg');
            const buttons = [{
                label: 'SET IMAGE FROM DATABANK',
                action: () => {
                    if (!photoArchive.length) { showNotification('DATABANK EMPTY -- TAKE A PHOTO FIRST.'); return; }
                    openAvatarSource();
                }
            }];
            if (hasImg) buttons.push({ label: 'RESET TO DEFAULT', color: '#ff3333', action: () => {
                localStorage.removeItem('pipboy-avatarimg');
                renderVaultBoy();
                showNotification('VAULT-BOY GRAPHIC RESET.');
            }});
            buttons.push({ label: 'CLOSE', color: 'var(--pip-color-dim)' });
            showCustomPrompt('VAULT-BOY GRAPHIC — A SQUARE CROP OF ANY SHOT IN YOUR DATABANK.', buttons);
        }

        function openAvatarSource() {
            photoPickMode = 'avatar';
            document.getElementById('pp-title').innerText = 'VAULT-BOY GRAPHIC: PICK A SHOT';
            let html = '<div class="photo-tile-grid">';
            photoArchive.forEach((e, i) => { html += `<div class="photo-tile" onclick="pickPhotoForMail(${i})"><img src="${entryPip(e)}"></div>`; });
            document.getElementById('pp-grid').innerHTML = html + '</div>';
            document.getElementById('photo-pick-modal').style.display = 'flex';
        }

        function setAvatarFromEntry(entry) {
            const img = new Image();
            img.onload = () => {
                try {
                    const side = Math.min(img.width, img.height);
                    const cv = document.createElement('canvas');
                    cv.width = 96; cv.height = 96;
                    cv.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 96, 96);
                    localStorage.setItem('pipboy-avatarimg', cv.toDataURL('image/jpeg', 0.7));
                    renderVaultBoy();
                    showNotification('VAULT-BOY GRAPHIC SET.');
                } catch (e) { showNotification('IMAGE UNREADABLE -- PICK ANOTHER.'); }
            };
            img.onerror = () => showNotification('IMAGE UNREADABLE -- PICK ANOTHER.');
            img.src = entryPip(entry);
        }

        function renderVaultBoy() {
            const wrap = document.getElementById('vb-img-wrap');
            const el = document.getElementById('vb-img');
            const def = document.getElementById('vb-default');
            if (!wrap || !el) return;
            const img = localStorage.getItem('pipboy-avatarimg');
            if (img) { el.src = img; wrap.style.display = 'block'; if (def) def.style.display = 'none'; }
            else { wrap.style.display = 'none'; if (def) def.style.display = ''; }
            renderVaultBoyFx();
        }

        function renderVaultBoyFx() {
            const wrap = document.getElementById('vb-img-wrap');
            const fx = document.getElementById('vb-fx');
            if (!wrap || !fx || wrap.style.display === 'none') return;
            wrap.classList.toggle('fx-rads', (userProfile.rads || 0) >= 250);
            // v0.67: Glowing One visual effect
            if (isGlowingOne) {
                fx.innerHTML = "<span class='vb-tre' style='left:6px;top:6px;color:#39ff14;text-shadow:0 0 10px #39ff14;'>☢</span><span class='vb-tre' style='right:6px;bottom:8px;color:#39ff14;text-shadow:0 0 10px #39ff14;animation-delay:.8s;'>☢</span><span class='vb-tre' style='right:10px;top:10px;color:#39ff14;text-shadow:0 0 10px #39ff14;animation-delay:1.4s;font-size:16px;'>☢</span>";
                wrap.style.boxShadow = '0 0 20px #39ff14, inset 0 0 20px rgba(57, 255, 20, 0.3)';
            } else if (radFieldActive) {
                fx.innerHTML = "<span class='vb-tre' style='left:6px;top:6px;color:#ff9a3c;'>☢</span><span class='vb-tre' style='right:6px;bottom:8px;color:#ff9a3c;animation-delay:.8s;'>☢</span><span class='vb-tre' style='right:10px;top:10px;color:#ff9a3c;animation-delay:1.4s;font-size:16px;'>☢</span>";
                wrap.style.boxShadow = '';
            } else if (medShelterActive) {
                fx.innerHTML = "<span class='vb-cross' style='left:6px;top:6px;color:#5fc98e;'>✚</span><span class='vb-cross' style='right:8px;bottom:10px;color:#5fc98e;animation-delay:.7s;'>✚</span><span class='vb-cross' style='right:12px;top:12px;color:#5fc98e;animation-delay:1.5s;font-size:16px;'>✚</span>";
                wrap.style.boxShadow = '';
            } else {
                fx.innerHTML = '';
                wrap.style.boxShadow = '';
            }
        }

        // --- v0.56: IN-COMPOSER QUICK CAPTURE -- take the shot without leaving the letter ---
        let qcStream = null;
        async function quickCamOpen() {
            try {
                qcStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: (typeof currentFacingMode !== 'undefined' && currentFacingMode === 'user') ? 'user' : 'environment' }, audio: false });
            } catch (e) { showNotification('OPTICS UNAVAILABLE -- PERMISSION DENIED OR SENSOR BUSY.'); return; }
            const v = document.getElementById('qc-video');
            if (v) v.srcObject = qcStream;
            document.getElementById('quickcam-modal').style.display = 'flex';
        }
        function quickCamClose() {
            if (qcStream) { qcStream.getTracks().forEach(t => t.stop()); qcStream = null; }
            const m = document.getElementById('quickcam-modal');
            if (m) m.style.display = 'none';
        }
        function quickCamSnap() {
            const v = document.getElementById('qc-video');
            if (!v || v.readyState < 2 || !v.videoWidth || !v.videoHeight) { showNotification('SENSOR WAKING -- ONE BEAT...'); return; }
            const c = document.getElementById('qc-canvas');
            const MAXD = 1024; // mail-scale: full frames would bloat letters past usefulness
            const scale = Math.min(1, MAXD / Math.max(v.videoWidth, v.videoHeight));
            c.width = Math.max(1, Math.round(v.videoWidth * scale));
            c.height = Math.max(1, Math.round(v.videoHeight * scale));
            const ctx = c.getContext('2d');
            if (typeof currentFacingMode !== 'undefined' && currentFacingMode === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1); } // mirror selfies like the main cam
            ctx.drawImage(v, 0, 0, c.width, c.height);
            cmAttach.photo = c.toDataURL('image/jpeg', 0.72); // string entry rides the letter as-is
            refreshAttachUi();
            quickCamClose();
            showNotification('PHOTO ATTACHED TO DRAFT.');
        }

        function closePhotoPick() {
            document.getElementById('photo-pick-modal').style.display = 'none';
            if (photoPickMode === 'attach') {
                // back to the draft — attachments and text survive the picker detour
                document.getElementById('compose-msg-modal').style.display = 'flex';
            }
            photoPickMode = 'send';
        }

        function pickPhotoForMail(idx) {
            const entry = photoArchive[idx];
            if (!entry) return closeModals();
            document.getElementById('photo-pick-modal').style.display = 'none';
            // v0.47 attach-mode: no immediate transmit — the composer's SEND commits the whole letter
            if (photoPickMode === 'attach') {
                photoPickMode = 'send';
                cmAttach.photo = entry;
                refreshAttachUi();
                document.getElementById('compose-msg-modal').style.display = 'flex';
                return;
            }
            // v0.50 avatar-mode: square-crop into the STATUS graphic, no mail involved
            if (photoPickMode === 'avatar') {
                photoPickMode = 'send';
                setAvatarFromEntry(entry);
                return;
            }
            const c = contactByUid(photoPickTarget);
            if (!c) return closeModals();
            showCustomPrompt('TRANSMIT THIS PHOTO TO ' + c.name + '?', [
                { label: 'SEND PHOTO', action: () => { sendPhotoMail(c, entry); } },
                { label: 'BACK', color: 'var(--pip-color-dim)', action: () => { document.getElementById('photo-pick-modal').style.display = 'flex'; } }
            ]);
        }

        function sendPhotoMail(c, entry) {
            // v0.47: transit compression extracted to compressMailPhoto() (shared with
            // composer attachments) — letter still rides the 'msg' type, ZERO rules changes
            compressMailPhoto(entry, url => {
                if (!url) { closeModals(); showNotification('PHOTO UNREADABLE -- TRANSMISSION ABORTED.'); return; }
                queueMail(c.uid, 'msg', { text: '📷 PHOTO TRANSMISSION', photo: url }, 'PHOTO');
                // v0.45: SENT photos keep a thumb on the log entry — viewable from the feed
                const logEntry = { dir: 'out', uid: c.uid, name: c.name, text: '📷 PHOTO TRANSMISSION', ts: Date.now(), hasPhoto: true };
                mailLog.unshift(logEntry);
                if (mailLog.length > 100) mailLog.pop();
                makeMailThumb(url, thumb => {
                    if (!thumb || mailLog.indexOf(logEntry) === -1) return;
                    logEntry.photo = thumb;
                    pruneMailPhotos();
                    saveComms();
                    if (mailTabActive()) renderMail();
                });
                saveComms();
                closeModals();
                notifyTxResult();
            });
        }

        // --- LINK REQUESTS panel (handshake outbox, lives under STATS — separate from mail) ---
        function renderLinkRequests() {            const el = document.getElementById('linkrequests-list');
            if (!el) return;
            const links = outbox.filter(e => e.type === 'handshake');
            if (!links.length) {
                el.innerHTML = '<p style="opacity:0.5;">NO PENDING LINK REQUESTS. SCAN A DATACARD OR SEND YOURS.</p>';
                return;
            }
            el.innerHTML = '';
            [...links].reverse().forEach(e => {
                const c = contactByUid(e.to);
                const row = document.createElement('div');
                row.className = 'item-row';
                row.style.cursor = 'default';
                row.innerHTML = '<div class="item-info"><div>↑ ' + escapeHtml(e.summary) + ' → ' + escapeHtml(c ? c.name : e.to) + '</div><div class="item-effects">' + escapeHtml(statusLabel(e)) + ' — ' + new Date(e.ts || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) + '</div></div><button class="theme-btn" onclick="clearOutboxEntry(\'' + e.id + '\'); renderLinkRequests();">[X]</button>';
                el.appendChild(row);
            });
        }

        // --- COMPOSERS ---
        // v0.37: MSG (+DATACARD via map card) is open to ANY beacon signal -- cold-send
        // restored. QUEST/ITEM stay contact-gated (contracts and item escrow need a link).
        // Unlinked recipients quarantine the letter as UNVERIFIED on their end (v0.31/0.34).
        function composeTargetInfo(uid) {
            if (!uid) return null;
            const c = contactByUid(uid);
            if (c) return { uid: c.uid, name: c.name, linked: true };
            const b = lastKnownBeaconData[uid];
            return { uid: uid, name: (b && b.name) ? b.name : 'UNKNOWN SIGNAL', linked: false };
        }
        function composeTo(kind, uidOverride, fromKey) {
            const uid = uidOverride || contactUidTarget;
            const t = composeTargetInfo(uid);
            if (!t) { showNotification('NO TARGET SELECTED.'); return; }
            if ((kind === 'quest' || kind === 'item') && !t.linked) { showNotification('SCAN THEIR DATACARD FIRST -- CONTRACTS AND ITEMS NEED A LINK.'); return; }
            contactUidTarget = t.uid;
            replyToKey = fromKey || null; // v0.61: store the message key we're replying to
            closeModals();
            if (kind === 'msg') {
                document.getElementById('cm-title').innerText = 'MESSAGE TO: ' + t.name + (t.linked ? '' : ' (UNLINKED)');
                const cm = document.getElementById('cm-text');
                cm.value = '';
                autoGrowEl(cm); // v0.44: reset the growing field to one line per open
                // v0.47: fresh letter, empty attachment slots
                cmAttach = { photo: null, itemId: null };
                refreshAttachUi();
                document.getElementById('compose-msg-modal').style.display = 'flex';
            } else if (kind === 'quest') {
                document.getElementById('cq-title').innerText = 'QUEST TO: ' + t.name;
                ['cq-name','cq-brief','cq-obj1','cq-obj2','cq-obj3','cq-reward','cq-loc','cq-time'].forEach(id => { document.getElementById(id).value = ''; });
                document.getElementById('compose-quest-modal').style.display = 'flex';
            } else if (kind === 'item') {
                openItemComposer(contactByUid(t.uid));
            }
        }

        // ================= MESSAGE ATTACHMENTS (v0.47) =================
        // A message letter can carry a DATABANK photo and/or ONE loadout item.
        // Photo rides payload.photo (same transit compression as SEND PHOTO); the item is
        // escrowed out of your inventory at transmit and auto-refunded on DECLINE (MOVE).
        let cmAttach = { photo: null, itemId: null };

        function refreshAttachUi() {
            const photoBtn = document.getElementById('cm-photo-btn');
            const itemBtn = document.getElementById('cm-item-btn');
            const note = document.getElementById('cm-attach-note');
            const it = cmAttach.itemId !== null ? items.find(x => x.id === cmAttach.itemId) : null;
            if (cmAttach.itemId !== null && !it) cmAttach.itemId = null; // stock vanished
            if (photoBtn) photoBtn.innerText = cmAttach.photo ? '[📷 PHOTO ✕]' : '[+ PHOTO]';
            if (itemBtn) itemBtn.innerText = it ? '[🎒 ' + String(it.name).substring(0, 12) + ' ✕]' : '[+ ITEM]';
            const bits = [];
            if (cmAttach.photo) bits.push('PHOTO FROM DATABANK');
            if (it) bits.push('1x ' + it.name + ' — LEAVES YOUR INVENTORY ON SEND');
            if (note) {
                note.style.display = bits.length ? 'block' : 'none';
                note.innerText = bits.length ? ('☷ ATTACHED: ' + bits.join(' + ') + '. TAP A BUTTON AGAIN TO CLEAR.') : '';
            }
        }

        function attachComposerPhoto() {
            if (cmAttach.photo) { cmAttach.photo = null; refreshAttachUi(); return; }
            const t = composeTargetInfo(contactUidTarget);
            if (!t) return;
            if (!isMutualLink(t.uid)) { showNotification('PHOTOS NEED A CONFIRMED LINK BOTH WAYS -- TEXT STILL WORKS.'); return; }
            if (!photoArchive.length) { showNotification('DATABANK EMPTY -- TAKE A PHOTO FIRST.'); return; }
            photoPickMode = 'attach'; // the databank picker hands the shot back to the composer
            photoPickTarget = t.uid;
            document.getElementById('pp-title').innerText = 'ATTACH PHOTO TO: ' + t.name;
            let html = '<div class="photo-tile-grid">';
            photoArchive.forEach((e, i) => { html += `<div class="photo-tile" onclick="pickPhotoForMail(${i})"><img src="${entryPip(e)}"></div>`; });
            document.getElementById('pp-grid').innerHTML = html + '</div>';
            document.getElementById('compose-msg-modal').style.display = 'none';
            document.getElementById('photo-pick-modal').style.display = 'flex';
        }

        function attachComposerItem() {
            if (cmAttach.itemId !== null) { cmAttach.itemId = null; refreshAttachUi(); return; }
            const avail = items.filter(it => it.quantity > 0);
            if (!avail.length) { showNotification('LOADOUT EMPTY -- NOTHING TO ATTACH.'); return; }
            const buttons = avail.map(it => ({
                label: '🎒 ' + it.name + ' x' + it.quantity,
                action: () => { cmAttach.itemId = it.id; refreshAttachUi(); }
            }));
            buttons.push({ label: 'CANCEL', color: 'var(--pip-color-dim)' });
            showCustomPrompt('ATTACH ONE ITEM (x1) TO THIS TRANSMISSION:', buttons);
        }

        // max-800px JPEG 0.55 transit compression (extracted from sendPhotoMail, v0.44)
        function compressMailPhoto(entry, cb) {
            const img = new Image();
            img.onload = function() {
                let url = entryPip(entry);
                try {
                    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
                    if (scale < 1) {
                        const cv = document.createElement('canvas');
                        cv.width = Math.floor(img.width * scale);
                        cv.height = Math.floor(img.height * scale);
                        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                        url = cv.toDataURL('image/jpeg', 0.55);
                    }
                } catch (e) {}
                cb(url);
            };
            img.onerror = function() { cb(null); };
            img.src = entryPip(entry);
        }

        function transmitMsg() {
            const text = document.getElementById('cm-text').value.trim();
            if (!text) return showNotification('MESSAGE CANNOT BE EMPTY.');
            const t = composeTargetInfo(contactUidTarget); // v0.37: unlinked beacon targets allowed
            if (!t) return closeModals();
            const attach = { photo: cmAttach.photo || null, item: null };
            if (cmAttach.itemId !== null) {
                const it = items.find(x => x.id === cmAttach.itemId);
                if (it) attach.item = { id: it.id, name: it.name, type: it.type, effects: it.effects };
            }
            closeModals();
            const fire = (photoUrl) => {
                const payload = { text: text.toUpperCase() };
                if (photoUrl) payload.photo = photoUrl;
                let summary = 'MESSAGE';
                if (photoUrl) summary += ' 📷';
                if (attach.item) {
                    payload.item = { name: attach.item.name, type: attach.item.type, effects: attach.item.effects, quantity: 1 };
                    summary += ' 🎒';
                    // MOVE: escrow the attached item NOW (auto-refunded if DECLINED)
                    const it = items.find(x => x.id === attach.item.id);
                    if (it) {
                        it.quantity -= 1;
                        if (it.quantity <= 0) items.splice(items.indexOf(it), 1);
                        saveToStorage();
                        renderInventory(currentInvTab);
                    }
                }
                queueMail(t.uid, 'msg', payload, summary);
                const logEntry = { dir: 'out', uid: t.uid, name: t.name, text: text.toUpperCase(), ts: Date.now(), hasPhoto: !!photoUrl, itemName: attach.item ? attach.item.name : null };
                mailLog.unshift(logEntry);
                if (mailLog.length > 100) mailLog.pop();
                // v0.61: if this is a reply, auto-log the original message (remove from ACTION REQUIRED)
                if (replyToKey && inboxLetters[replyToKey]) {
                    acceptMsg(replyToKey, inboxLetters[replyToKey]);
                    replyToKey = null;
                }
                if (photoUrl) makeMailThumb(photoUrl, thumb => {
                    if (!thumb || mailLog.indexOf(logEntry) === -1) return;
                    logEntry.photo = thumb;
                    pruneMailPhotos();
                    saveComms();
                    if (mailTabActive()) renderMail();
                });
                saveComms();
                if (mailTabActive()) renderMail(); // v0.60: re-render mail feed so reply appears immediately
                notifyTxResult();
            };
            if (attach.photo) {
                compressMailPhoto(attach.photo, url => {
                    if (!url) { showNotification('PHOTO UNREADABLE -- TRANSMISSION ABORTED.'); return; }
                    fire(url);
                    setTimeout(() => { if (mailTabActive()) renderMail(); }, 50); // v0.61: delayed re-render after modal close
                });
            } else {
                fire(null);
                setTimeout(() => { if (mailTabActive()) renderMail(); }, 50); // v0.61: delayed re-render after modal close
            }
        }

        function transmitQuest() {
            const title = document.getElementById('cq-name').value.trim();
            if (!title) return showNotification('A QUEST NEEDS A TITLE.');
            const brief = document.getElementById('cq-brief').value.trim().toUpperCase();
            const location = (document.getElementById('cq-loc').value.trim() || 'P2P LINK').toUpperCase();
            const objectives = ['cq-obj1','cq-obj2','cq-obj3']
                .map(id => document.getElementById(id).value.trim())
                .filter(Boolean)
                .map(s => s.toUpperCase());
            if (!objectives.length) objectives.push('COMPLETION TERMS: SEE GIVER.');
            const reward = document.getElementById('cq-reward').value.trim().toUpperCase();

            // v0.34: expiration now accepts a clock time just like +ADD QUEST ("18:00" or "1800")
            const timeInput = document.getElementById('cq-time').value.trim();
            let expireTime = null, timeStr = '--:--';
            if (timeInput) {
                let h = NaN, m = NaN;
                if (timeInput.includes(':')) {
                    const parts = timeInput.split(':');
                    h = parseInt(parts[0], 10); m = parseInt(parts[1], 10);
                } else {
                    const clean = timeInput.replace(/[^0-9]/g, '');
                    if (clean.length >= 3) {
                        h = parseInt(clean.substring(0, clean.length - 2), 10);
                        m = parseInt(clean.substring(clean.length - 2), 10);
                    }
                }
                if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
                    const d = new Date();
                    d.setHours(h, m, 0, 0);
                    if (d < new Date()) d.setDate(d.getDate() + 1); // past today = tomorrow
                    expireTime = d.getTime();
                    timeStr = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
                } else {
                    return showNotification('EXPIRATION MUST BE A 24H CLOCK TIME (e.g. 18:00) OR LEFT BLANK.');
                }
            }

            const c = contactByUid(contactUidTarget);
            // v0.48: no more silent deaths — this used to close the composer with zero
            // feedback and read as "the contract never went out"
            if (!c) { closeModals(); showNotification('TARGET LINK LOST -- RESELECT THEIR DATACARD OR BEACON.'); return; }
            queueMail(c.uid, 'quest', { title: title.toUpperCase(), brief: brief, location: location, objectives: objectives, reward: reward, expireTime: expireTime, timeStr: timeStr }, 'QUEST: ' + title.toUpperCase());
            closeModals();
            // v0.48: breadcrumb — issued quests track on YOUR side under CONTRACTS
            // (QUESTS is for quests YOU hold), which is exactly where people look first
            showNotification('CONTRACT ISSUED — TRACK IT UNDER DATA > CONTRACTS.');
            notifyTxResult();
        }

        function openItemComposer(c) {
            document.getElementById('ci-title').innerText = 'ITEM TO: ' + c.name;
            ciSelectedItemId = null;
            document.getElementById('ci-qty').value = '1';
            const list = document.getElementById('ci-item-list');
            list.innerHTML = '';
            if (!items.length) {
                list.innerHTML = '<p style="text-align:center; opacity:0.5; padding:10px;">INVENTORY EMPTY</p>';
            } else {
                items.forEach(it => {
                    const row = document.createElement('div');
                    row.className = 'item-row';
                    row.innerHTML = '<div class="item-info"><div>' + escapeHtml(it.name) + '</div><div class="item-effects">' + escapeHtml(it.effects || '') + '</div></div><div class="item-qty">x' + it.quantity + '</div>';
                    row.onclick = () => {
                        ciSelectedItemId = it.id;
                        list.querySelectorAll('.item-row').forEach(r => r.style.background = '');
                        row.style.background = 'var(--pip-color-dim)';
                        const cur = parseInt(document.getElementById('ci-qty').value, 10) || 1;
                        if (cur > it.quantity) document.getElementById('ci-qty').value = it.quantity;
                    };
                    list.appendChild(row);
                });
            }
            document.getElementById('compose-item-modal').style.display = 'flex';
        }

        function ciStep(d) {
            const it = items.find(x => x.id === ciSelectedItemId);
            const el = document.getElementById('ci-qty');
            let v = parseInt(el.value, 10) || 1;
            const max = it ? it.quantity : 1;
            v = Math.max(1, Math.min(max, v + d));
            el.value = v;
        }

        function transmitItem() {
            const it = items.find(x => x.id === ciSelectedItemId);
            if (!it) return showNotification('SELECT AN ITEM FROM YOUR LOADOUT.');
            const qty = Math.max(1, Math.min(it.quantity, parseInt(document.getElementById('ci-qty').value, 10) || 1));
            const c = contactByUid(contactUidTarget);
            if (!c) return closeModals();
            showCustomPrompt('TRANSMIT ' + it.name + ' x' + qty + ' TO ' + c.name + '? IT LEAVES YOUR INVENTORY NOW.', [
                {
                    label: 'TRANSMIT',
                    action: () => {
                        // MOVE: escrow the goods at transmit time (auto-refunded if DECLINED)
                        it.quantity -= qty;
                        if (it.quantity <= 0) items.splice(items.indexOf(it), 1);
                        saveToStorage();
                        renderInventory(currentInvTab);
                        queueMail(c.uid, 'item', { name: it.name, type: it.type, effects: it.effects, quantity: qty }, 'ITEM: ' + it.name + ' x' + qty);
                        closeModals();
                        notifyTxResult();
                    }
                },
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        // v0.38: SEND NEW MESSAGE straight from the MAIL tab -- lists every linked
        // contact (rolodex) as recipient buttons; tap one and the composer opens.
        function openRecipientPicker(kind) {
            kind = kind || 'msg';
            if (!rolodex.length) { showNotification('NO CONTACTS LINKED -- SCAN A DATACARD FIRST.'); return; }
            const buttons = rolodex.map(c => ({
                label: (kind === 'quest' ? '☢ ' : '✉ ') + c.name,
                action: () => composeTo(kind, c.uid)
            }));
            buttons.push({ label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} });
            showCustomPrompt(kind === 'quest' ? 'ISSUE CONTRACT TO:' : 'SELECT RECIPIENT:', buttons);
        }

        // v0.55: [+ ISSUE NEW QUEST] on DATA > CONTRACTS -- pick a wastelander, land in the composer
        function issueQuestStart() { openRecipientPicker('quest'); }

        // v0.56: [SAVE PHOTO] on inbound transmissions -- files the shot into the CAM DATABANK
        function saveMailPhoto(dataUrl) {
            if (!dataUrl || typeof dataUrl !== 'string') return;
            photoArchive.unshift(dataUrl); // string entries are first-class (entryPip handles both)
            try { localStorage.setItem('pipboy-photos', JSON.stringify(photoArchive)); }
            catch (e) { showNotification('DATABANK FULL -- PHOTO COULD NOT BE FILED.'); return; }
            const camTab = document.getElementById('tab-cam');
            if (camTab && camTab.classList.contains('active')) renderPhotoGallery();
            showNotification('PHOTO FILED TO DATABANK.');
        }

        function renderMail() {
            const el = document.getElementById('mail-container');
            if (!el) return;
            let html = '';

            // v0.33: mail is a FLAT feed of per-message entities (no outlook-style
            // folders/per-user grouping). Zone 1 = anything needing action, pinned top.
            // Zone 2 = one merged chronological history of sent + received transmissions.
            // v0.48: timeOf is now a global helper (contracts/rad panels use it too)

            // ---- ZONE 1: ACTION REQUIRED ----
            const inKeys = Object.keys(inboxLetters).sort((a, b) => (inboxLetters[b].ts || 0) - (inboxLetters[a].ts || 0));
            const uKeys = Object.keys(unverifiedLetters).sort((a, b) => (unverifiedLetters[b].ts || 0) - (unverifiedLetters[a].ts || 0));
            const lsKeys = Object.keys(linkScans).sort((a, b) => (linkScans[b].ts || 0) - (linkScans[a].ts || 0)); // v0.45: parked link scans
            if (inKeys.length || uKeys.length || lsKeys.length) {
                html += '<h3 style="border-bottom:2px solid #ff3333; padding-bottom:5px; margin-bottom:10px; color:#ff3333; text-shadow:0 0 6px #ff3333;">⚠ ACTION REQUIRED</h3>'; // v0.55: blood-red per user
                inKeys.forEach(k => {
                    const l = inboxLetters[k];
                    html += '<div class="item-row" onclick="openMailItem(\'' + k + '\')"><div class="item-info"><div>↓ ' + escapeHtml(typeSummary(l)) + '</div><div class="item-effects">FROM: ' + escapeHtml(l.fromName || 'UNKNOWN') + ' — ' + timeOf(l.ts) + ' — TAP TO RESPOND</div></div><div class="item-qty">&gt;</div></div>';
                });
                uKeys.forEach(k => {
                    const l = unverifiedLetters[k];
                    html += '<div class="item-row" style="opacity:0.8;" onclick="openUntrusted(\'' + k + '\')"><div class="item-info"><div>⚠ UNTRUSTED ' + escapeHtml((l.type || '???').toUpperCase()) + '</div><div class="item-effects">CLAIMS TO BE: ' + escapeHtml(l.fromName || 'UNKNOWN') + ' — TAP FOR OPTIONS</div></div><div class="item-qty">?</div></div>';
                });
                lsKeys.forEach(k => {
                    const l = linkScans[k];
                    html += '<div class="item-row" onclick="openLinkScan(\'' + k + '\')"><div class="item-info"><div>⇄ LINK REQUEST (PARKED)</div><div class="item-effects">FROM: ' + escapeHtml(l.fromName || 'UNKNOWN') + ' — ' + timeOf(l.ts) + ' — TAP TO DECIDE</div></div><div class="item-qty">?</div></div>';
                });
            }

            // ---- ZONE 2: merged history feed (outbox + message log, newest first) ----
            // v0.34: handshakes are excluded — link requests live under STATS, not mail
            const history = [];
            outbox.forEach(e => { if (e.type !== 'handshake') history.push({ ts: e.ts || 0, kind: 'out', e: e }); });
            mailLog.forEach(m => history.push({ ts: m.ts || 0, kind: 'log', m: m }));
            history.sort((a, b) => b.ts - a.ts);

            if (inKeys.length || uKeys.length || lsKeys.length || history.length) {
                html += '<h3 style="border-bottom:1px dashed var(--pip-color-dim); padding-bottom:5px; margin:20px 0 10px; opacity:0.8;">TRANSMISSIONS</h3>';
            }
            if (!history.length) {
                if (!inKeys.length && !uKeys.length && !lsKeys.length) {
                    html += '<p style="text-align:center; opacity:0.5; margin-top:30px;">NO TRANSMISSIONS YET.<br>SCAN A WASTELANDER\'S DATACARD TO START TALKING.</p>';
                } else {
                    html += '<p style="opacity:0.5;">NOTHING SENT OR LOGGED YET.</p>';
                }
            } else {
                history.slice(0, 50).forEach(h => {
                    if (h.kind === 'out') {
                        const e = h.e;
                        const c = contactByUid(e.to);
                        const terminal = (e.status === 'accepted' || e.status === 'declined' || e.status === 'fulfilled' || e.status === 'closed');
                        const clearable = terminal || e.status === 'queued';
                        html += '<div class="item-row" style="cursor:default;"><div class="item-info"><div>↑ ' + escapeHtml(e.summary) + ' → ' + escapeHtml(c ? c.name : e.to) + '</div><div class="item-effects">' + escapeHtml(statusLabel(e)) + ' — ' + timeOf(e.ts) + '</div></div>' + (clearable ? '<button class="theme-btn" onclick="clearOutboxEntry(\'' + e.id + '\')">[X]</button>' : '') + '</div>';
                    } else {
                        const m = h.m;
                        // v0.45: rows are one-line PREVIEWS (a long message used to blow the
                        // row into a wall of text) -- tap any row for the full message plus
                        // its photo; incoming rows keep their one-tap REPLY shortcut
                        const idx = mailLog.indexOf(m);
                        const tag = (m.fulfilledTitle ? ' ⚑' : '') + (m.hasPhoto ? ' 📷' : '') + (m.itemName ? ' 🎒' : ''); // v0.47: stacked tags
                        const fullText = m.text || '';
                        const prev = fullText.length > 60 ? fullText.slice(0, 60) + '…' : fullText;
                        html += '<div style="border-bottom:1px dashed var(--pip-color-dim); padding:6px 0; font-size:1rem; display:flex; justify-content:space-between; gap:8px; align-items:center; cursor:pointer;" onclick="viewMailLogEntry(' + idx + ')"><span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><span style="opacity:0.7;">' + (m.dir === 'in' ? '↓ FROM ' : '↑ TO ') + escapeHtml(m.name) + ' — ' + timeOf(m.ts) + ':</span> ' + escapeHtml(prev) + tag + '</span>' + (m.dir === 'in' && m.uid ? '<button class="theme-btn" style="flex-shrink:0;" onclick="event.stopPropagation(); composeTo(\'msg\', \'' + m.uid + '\')">[REPLY]</button>' : '') + '</div>';
                    }
                });
            }
            el.innerHTML = html;
        }

        // v0.45: full message viewer — tapped from any TRANSMISSIONS row. Long text
        // scrolls INSIDE the box (40vh cap set on #cp-text, buttons always stay on
        // screen), photo thumbs render above the text, fulfil notices can still
        // complete YOUR copy, incoming rows carry REPLY.
        function viewMailLogEntry(i) {
            const m = mailLog[i];
            if (!m) return;
            const stamp = (m.dir === 'in' ? 'FROM ' : 'TO ') + (m.name || 'UNKNOWN') + ' — ' + timeOf(m.ts);
            let body = m.text || '(NO TEXT)';
            if (m.fulfilledTitle) body = '⚑ FULFIL NOTICE — ' + m.fulfilledTitle + '\n\n' + body;
            if (m.itemName) body += '\n\n🎒 ATTACHED ITEM: ' + m.itemName + ' x1'; // v0.47
            if (m.hasPhoto && !m.photo) {
                // v0.48: mail is the only home for received photos now — no databank fallback
                body += '\n\n(IMAGE PURGED FROM LOG — DATABANK PRESSURE.)';
            }
            const buttons = [];
            const myCopy = m.fulfilledTitle ? quests.find(q => q.name === String(m.fulfilledTitle).toUpperCase() && !q.completed) : null;
            if (myCopy) {
                buttons.push({ label: 'MARK MY COPY COMPLETE', action: () => {
                    myCopy.completed = true;
                    saveToStorage();
                    renderQuests();
                    showNotification('YOUR COPY MARKED COMPLETE: ' + myCopy.name);
                }});
            }
            if (m.dir === 'in' && m.uid) buttons.push({ label: 'REPLY', action: () => composeTo('msg', m.uid) });
            if (m.photo) buttons.push({ label: 'SAVE PHOTO', action: () => saveMailPhoto(m.photo) }); // v0.56
            buttons.push({ label: 'CLOSE', color: 'var(--pip-color-dim)' });
            showCustomPrompt(stamp + '\n\n' + body, buttons);
            // cp modal is open now — hang the photo on it if one survived the storage guard
            if (m.photo) {
                const img = document.getElementById('cp-img');
                if (img) { img.src = m.photo; img.style.display = 'block'; }
            }
        }

        function statusLabel(e) {
            switch (e.status) {
                case 'queued': return 'QUEUED (NO SIGNAL)';
                case 'sending': return 'QUEUED ON THIS UNIT -- SHIPS WHEN OPEN IN SIGNAL'; // v0.55: honest ownership copy
                case 'sent': return 'AWAITING RESPONSE';
                case 'accepted': return 'ACCEPTED ✓';
                case 'declined': return e.refunded ? 'DECLINED ✗ (RETURNED)' : 'DECLINED ✗';
                case 'fulfilled': return 'CONTRACT FULFILLED ✓';
                case 'closed': return 'LINK CLOSED';
            }
            return (e.status || '???').toUpperCase();
        }

        function clearOutboxEntry(id) {
            const idx = outbox.findIndex(e => e.id === id);
            if (idx === -1) return;
            const e = outbox[idx];
            if (e.key && window.db) {
                window.firebaseRemove(window.firebaseRef(window.db, 'mail/' + e.to + '/' + e.key)).catch(() => {});
            }
            outbox.splice(idx, 1);
            saveComms();
            renderMail();
        }

        // --- MAP STICKY-SELECT (tap a wastelander beacon) ---
        function selectBeacon(uid) {
            selectedBeaconUid = safeUid(uid);
            deselectZone(); // v0.51: one selection at a time -- clears zone label/card
            deselectPin(); // v0.56
            updateMapUserCard();
        }
        function deselectBeacon() {
            selectedBeaconUid = null;
            deselectZone(); // v0.51: [X] / map-tap / GPS-off clear zone selections as well
            deselectPin(); // v0.56: and shared-pin selections
            const card = document.getElementById('map-user-card');
            if (card) card.style.display = 'none';
            const nm = document.getElementById('muc-name');
            if (nm) nm.style.color = ''; // v0.51: zone cards colour the name -- never bleed onto beacons
        }
        // v0.51: ZONE STICKY-SELECT. Zones render as silent fences (labels no longer live,
        // per user); tapping the fence or its diamond reveals the label + pins the card.
        // Overseer (dev mode) units get [EXTINGUISH] right here on the map -- no STATS trip.
        function selectZone(zk) {
            if (selectedBeaconUid) selectedBeaconUid = null; // one card at a time
            deselectPin(); // v0.56
            if (selectedZoneKey && selectedZoneKey !== zk) {
                const prev = zoneMarkerRefs[selectedZoneKey];
                if (prev) prev.closeTooltip();
            }
            selectedZoneKey = zk;
            const zm = zoneMarkerRefs[zk];
            if (zm) zm.openTooltip();
            updateZoneCard();
        }
        function deselectZone() {
            if (selectedZoneKey) {
                const zm = zoneMarkerRefs[selectedZoneKey];
                if (zm) zm.closeTooltip();
                selectedZoneKey = null;
            }
            const card = document.getElementById('map-user-card');
            if (card && !selectedBeaconUid) card.style.display = 'none';
        }
        // v0.56: shared-pin sticky select + Overseer broadcast-pin removal (zone warden sibling)
        let selectedPinKey = null;
        function selectSharedPin(key) {
            deselectBeacon(); // one card at a time (clears beacon + zone + pin)
            selectedPinKey = key;
            const pm = pinMarkerRefs[key];
            if (pm) pm.openTooltip();
            updatePinCard();
        }
        function deselectPin() {
            if (selectedPinKey) {
                const pm = pinMarkerRefs[selectedPinKey];
                if (pm) pm.closeTooltip();
                selectedPinKey = null;
            }
        }
        function updatePinCard() {
            const card = document.getElementById('map-user-card');
            if (!card) return;
            const key = selectedPinKey;
            if (!key) return;
            const p = lastKnownSharedPins[key];
            if (!p) { deselectPin(); card.style.display = 'none'; return; }
            const nameEl = document.getElementById('muc-name');
            nameEl.innerText = String(p.label || 'BROADCAST MARKER').toUpperCase();
            nameEl.style.color = 'var(--pip-color)';
            let info = 'SHARED BY ' + String(p.fromName || 'UNKNOWN').toUpperCase();
            if (myLastLat !== null && typeof p.lat === 'number') {
                const d = getDistance(myLastLat, myLastLng, p.lat, p.lng);
                info += ' | ' + (d < 1000 ? Math.round(d) + 'M AWAY' : ((d / 1000).toFixed(1) + 'KM AWAY'));
            }
            document.getElementById('muc-info').innerText = info;
            const vc = document.getElementById('muc-vitals'); if (vc) { vc.style.display = 'none'; vc.innerHTML = ''; } // pins have no vitals
            const actions = document.getElementById('muc-actions');
            if (localStorage.getItem('pipboy-dev-mode') === 'true') {
                actions.innerHTML = '<button class="theme-btn" style="flex:1; border-color:#ff3333; color:#ff3333;" onclick="removeSharedPin(\'' + key + '\')">[REMOVE BROADCAST]</button>';
            } else {
                actions.innerHTML = '<div style="font-size:0.85rem; opacity:0.7; width:100%;">BROADCAST MARKER -- EVERY UNIT SEES THIS PIN.</div>';
            }
            card.style.display = 'block';
        }
        function removeSharedPin(key) {
            const lbl = String((lastKnownSharedPins[key] || {}).label || 'THIS MARKER').toUpperCase();
            showCustomPrompt('REMOVE "' + lbl + '" FROM EVERY UNIT\'S MAP?', [
                { label: 'REMOVE BROADCAST', color: '#ff3333', action: () => {
                    if (!window.db) { showNotification('NO SATELLITE LINK.'); return; }
                    window.firebaseRemove(window.firebaseRef(window.db, 'sharedpins/' + key))
                        .then(() => {
                            showNotification('BROADCAST PIN REMOVED FROM ALL UNITS.');
                            deselectPin();
                            const card = document.getElementById('map-user-card');
                            if (card) card.style.display = 'none';
                        })
                        .catch(() => showNotification('REMOVAL REJECTED -- CHECK SIGNAL.'));
                }},
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        function updateZoneCard() {
            const card = document.getElementById('map-user-card');
            if (!card) return;
            const zk = selectedZoneKey;
            if (!zk) return;
            const z = lastKnownRadZones[zk];
            if (!z) { deselectZone(); return; }
            // v0.58: kind-aware zone card (hot / med / decon)
            const kind = z.kind || 'hot';
            const color = kind === 'med' ? '#5fc98e' : (kind === 'decon' ? '#42d4f5' : '#ff3333');
            const glyph = kind === 'med' ? '✚ ' : (kind === 'decon' ? '✦ ' : '☢ ');
            const defaultLabel = kind === 'med' ? 'MED ZONE' : (kind === 'decon' ? 'DECON STATION' : 'HOT ZONE');
            const nameEl = document.getElementById('muc-name');
            nameEl.innerText = glyph + String(z.label || defaultLabel).toUpperCase();
            nameEl.style.color = color;
            const radius = (typeof z.radius === 'number' ? z.radius : 15);
            let info = kind === 'med'
                ? 'MED SHELTER | ' + radius + 'M RADIUS | SHEDS 5 RADS/MIN INSIDE'
                : (kind === 'decon'
                    ? 'DECONTAMINATION | ' + radius + 'M | SHEDS ALL RADS + MUTATION CYCLE ON ENTRY'
                    : 'RADIATION FIELD | ' + radius + 'M RADIUS | +1 RAD/5SEC INSIDE');
            if (myLastLat !== null && typeof z.lat === 'number' && typeof z.lng === 'number') {
                const d = getDistance(myLastLat, myLastLng, z.lat, z.lng);
                info += ' | ' + (d < 1000 ? Math.round(d) + 'M AWAY' : ((d / 1000).toFixed(1) + 'KM AWAY'));
            }
            document.getElementById('muc-info').innerText = info;
            const vit = document.getElementById('muc-vitals'); // v0.52: zones carry no vitals -- clear any beacon bar
            if (vit) { vit.innerHTML = ''; vit.style.display = 'none'; }
            const actions = document.getElementById('muc-actions');
            if (localStorage.getItem('pipboy-dev-mode') === 'true') {
                actions.innerHTML = '<button class="theme-btn" style="flex:1; border-color:' + color + '; color:' + color + ';" onclick="extinguishZone(\'' + escapeHtml(zk) + '\')">[ EXTINGUISH ]</button>';
            } else {
                actions.innerHTML = '<div style="font-size:0.85rem; opacity:0.7; width:100%;">OVERSEER ZONE -- FIELD ACTIVE FOR ALL UNITS.</div>';
            }
            card.style.display = 'block';
        }
        function updateMapUserCard() {
            const card = document.getElementById('map-user-card');
            if (!card) return;
            const uid = selectedBeaconUid;
            if (!uid) { card.style.display = 'none'; return; }
            const b = lastKnownBeaconData[uid];
            const contact = contactByUid(uid);
            const name = contact ? contact.name : ((b && b.name) ? b.name : 'UNKNOWN SIGNAL');
            let info;
            if (b && b.timestamp) {
                const m = Math.floor((Date.now() - b.timestamp) / 60000);
                info = m < 5 ? 'LIVE SIGNAL' : ('LKL ' + m + 'M AGO');
                if (myLastLat !== null) {
                    const d = getDistance(myLastLat, myLastLng, b.lat, b.lng);
                    info += ' | ' + (d < 1000 ? Math.round(d) + 'M AWAY' : ((d / 1000).toFixed(1) + 'KM AWAY'));
                } else {
                    info += ' | YOUR GPS OFFLINE';
                }
                // v0.51 LINK TELEMETRY: linked contacts broadcast hp/rads on their beacon.
                // Vitals render for datacard-linked signals ONLY -- strangers stay anonymous.
                if (contact && typeof b.hp === 'number' && typeof b.rads === 'number') {
                    info += ' | HP ' + b.hp + ' | ' + b.rads + ' RADS';
                }
            } else {
                info = 'SIGNAL LOST';
            }
            const nameEl = document.getElementById('muc-name');
            // v0.58: orange mutant indicator next to name when beacon has mutations
            const mutCount = (uid === myMailUid) ? activeMutations.length : ((b && typeof b.mutations === 'number') ? b.mutations : 0);
            nameEl.innerHTML = escapeHtml(name) + (mutCount > 0 ? ' <span style="color:#ff9a3c; text-shadow:0 0 5px #ff9a3c;" title="' + mutCount + ' MUTATION' + (mutCount > 1 ? 'S' : '') + '">☢' + mutCount + '</span>' : '');
            nameEl.style.color = ''; // v0.51: reset any zone-card colour
            document.getElementById('muc-info').innerText = info;
            const actions = document.getElementById('muc-actions');
            // v0.39: tapping YOUR OWN dot pins the same card -- status line only, no
            // self-addressed comms buttons (datacard/link requests to yourself are nonsense)
            if (uid === myMailUid) {
                actions.innerHTML = '<div style="font-size:0.85rem; opacity:0.7; width:100%;">THIS IS YOUR LIVE SIGNAL -- ' +
                    (scramblerOn() ? 'SCRAMBLED: EVERYONE SEES YOUR DECOY-SITE DOT.' : 'OTHER WASTELANDERS SEE THIS DOT.') + '</div>';
            } else if (contact) {
                actions.innerHTML =
                    '<button class="theme-btn" style="flex:1;" onclick="composeTo(\'msg\', \'' + uid + '\')">[ MSG ]</button>' +
                    '<button class="theme-btn" style="flex:1;" onclick="composeTo(\'quest\', \'' + uid + '\')">[ QUEST ]</button>';
            } else {
                // v0.37: cold-contact restored -- datacard (link request) + one-way message
                // straight from the map card; quests/items still require a mutual scan.
                actions.innerHTML =
                    '<button class="theme-btn" style="flex:1;" onclick="sendDatacardToUid(\'' + uid + '\')">[ SEND DATACARD ]</button>' +
                    '<button class="theme-btn" style="flex:1;" onclick="composeTo(\'msg\', \'' + uid + '\')">[ MSG ]</button>' +
                    '<div style="font-size:0.85rem; opacity:0.7; width:100%;">UNLINKED SIGNAL -- MSG ARRIVES UNVERIFIED THEIR END. SCAN THEIR DATACARD FOR CONTRACTS/ITEMS.</div>';
            }
            // v0.52: the overtaking vitals bar rides the card for linked telemetry units
            const vit = document.getElementById('muc-vitals');
            if (vit) {
                if (contact && b && typeof b.hp === 'number' && typeof b.rads === 'number') {
                    vit.innerHTML = vitalsBarHtml(b.hp, b.rads);
                    vit.style.display = 'block';
                } else {
                    vit.innerHTML = '';
                    vit.style.display = 'none';
                }
            }
            card.style.display = 'block';
        }

        // v0.37: transmit your datacard to ANY beacon signal from the map card
        // (their link-request prompt = same as if they had scanned you physically).
        function sendDatacardToUid(uid) {
            const b = lastKnownBeaconData[uid];
            const name = ((b && b.name) ? b.name : 'THIS SIGNAL').toUpperCase();
            showCustomPrompt('TRANSMIT YOUR DATACARD TO ' + name + '? THEY WILL GET A LINK REQUEST JUST AS IF THEY SCANNED YOU.', [
                {
                    label: 'SEND DATACARD',
                    action: () => { sendHandshake(uid); notifyTxResult(); renderLinkRequests(); }
                },
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        // --- COMMS BOOT: listener + outbox flush, with retry until Firebase is up ---
        let commsBootRetries = 0;
        function initComms() {
            if (window.db) {
                startMailListener();
                startPariahListener(); // v0.46
                startRadZoneListener(); // v0.47
                startStarchedListener(); // v0.58: Starched Genes global toggle
                startGlobalContractsListener(); // v0.70: Global contracts
                startBountiesListener(); // v0.70: Bounties
                flushOutbox();
                refreshOutboxStatuses();
                renderMailBadge();
            } else if (commsBootRetries < 40) {
                commsBootRetries++;
                setTimeout(initComms, 2500);
            }
        }
        window.addEventListener('online', () => { flushOutbox(); refreshOutboxStatuses(); });
        setInterval(() => { flushOutbox(); refreshOutboxStatuses(); }, 20000);
        // v0.55: wake-and-ship -- when the app returns from sleep/backgound, flush any
        // letters Android froze mid-send (root cause of the "7-minute quest" report).
        // v0.56: WAKE-STAMP -- a unit returning from sleep must IMMEDIATELY re-announce
        // itself: beacons age out of the LIVE census after 5 min of silence, and a
        // stationary player may never fire another geolocation event. Re-push the beacon
        // (only if the player opted into live tracking) and re-run the rad/pariah field
        // math against whatever zones are freshest.
        function wakeStamp() {
            try {
                if (liveTrackingEnabled && myLastLat !== null && myLastLng !== null) pushMyBeacon(myLastLat, myLastLng);
                evalPariahField();
            } catch (e) {}
        }
        document.addEventListener('visibilitychange', () => { if (!document.hidden) { wakeStamp(); flushOutbox(); refreshOutboxStatuses(); } });
        window.addEventListener('pageshow', () => { wakeStamp(); flushOutbox(); refreshOutboxStatuses(); });

        // ========================= POX RADIO (v0.53) =========================
        // Three looping dials from radio-stations.json (precached app file). Audio lives
        // ONLY on the radio CDN (base field per station) — nothing rides the app bundle.
        // Packs download once into a dedicated Cache bucket (RADIO_CACHE, whitelisted in
        // sw.js so app updates never wipe your stations) and play offline forever;
        // undownloaded dials stream while online. Playback routes through the SW's
        // cross-origin cache-first branch, so a downloaded pack answers even with the
        // radio off. Static bursts are synthesized (no file). No DJ/bulletins (user cut).
        const RADIO_CACHE = 'pox-radio-v1';
        let radioManifest = null;
        let radioCur = null;            // station id currently playing, or null
        let radioTrackIdx = 0;
        let radioDlState = {};          // { sid: true } pipboy-radio-dl (the ONBOARD badge)
        let radioPos = {};              // { sid: lastTrackIdx } pipboy-radio-pos (resume memory)
        let radioDlRunning = false;
        let radioDlStop = false;
        // --- v0.54 STATION SYNC (shared epoch playheads) ---
        let radioLive = {};            // { sid: {epoch} } straight from the radio/ node
        let radioServerOffset = 0;     // ms skew vs the satellite, via /.info/serverTimeOffset (phone clocks lie)
        let radioSyncOn = localStorage.getItem('pipboy-radio-sync') !== 'off'; // default ON
        let radioAppliedEpoch = {};    // { sid: epoch } this unit last joined with -- a change = SKIP/RESTART
        let radioSyncTimer = null;     // 5s drift watchdog while synced
        let radioOrder = {};           // v0.56: free-run shuffle memory { sid: [trackIdx,...] }
        const radioAudio = new Audio();
        radioAudio.preload = 'auto';

        function stationById(sid) { return radioManifest ? radioManifest.stations.find(s => s.id === sid) : null; }
        function trackUrl(st, tr) { return st.base + '/' + encodeURIComponent(tr.f); }
        function saveRadioState() {
            localStorage.setItem('pipboy-radio-dl', JSON.stringify(radioDlState));
            localStorage.setItem('pipboy-radio-pos', JSON.stringify(radioPos));
        }

        function initRadio() {
            radioDlState = JSON.parse(localStorage.getItem('pipboy-radio-dl') || '{}');
            radioPos = JSON.parse(localStorage.getItem('pipboy-radio-pos') || '{}');
            fetch('radio-stations.json').then(r => r.json()).then(m => {
                radioManifest = m;
                m.stations.forEach(s => { s.totalDur = s.tracks.reduce((a, t) => a + (t.d || 0), 0); }); // v0.54: sync math needs loop lengths
                renderRadioTab();
            }).catch(() => {
                const el = document.getElementById('radio-now');
                if (el) el.innerText = 'STATION MANIFEST OFFLINE -- RETRY WHEN IN SIGNAL RANGE.';
            });
            initRadioSync(0); // v0.54: satellite listeners (waits for window.db, retries like initComms)
        }

        function renderRadioTab() {
            if (!radioManifest) return;
            radioManifest.stations.forEach(st => {
                const row = document.getElementById('rs-' + st.id);
                if (!row) return;
                const state = row.querySelector('.rs-state');
                const live = !!(radioLive[st.id] && radioLive[st.id].epoch); // v0.54 LIVE badge
                let txt;
                if (st.tracks.length === 0) {
                    txt = 'NO CONNECTION';
                } else {
                    txt = radioDlState[st.id]
                        ? 'ONBOARD'
                        : (st.tracks.length + ' TRKS · ' + (st.tracks.reduce((a, t) => a + t.b, 0) / 1048576).toFixed(1) + 'MB');
                }
                if (live) txt = '· LIVE · ' + txt;
                if (state) {
                    state.innerText = txt;
                    state.style.color = live ? '#ffb642' : (st.tracks.length === 0 ? '#ff3333' : '');
                    state.style.textShadow = live ? '0 0 5px #ffb642' : (st.tracks.length === 0 ? '0 0 5px #ff3333' : '');
                }
                row.classList.toggle('playing', radioCur === st.id);
            });
            const sb = document.getElementById('radio-sync-btn');
            if (sb) sb.innerText = '[ STATION SYNC: ' + (radioSyncOn ? 'ON' : 'OFF') + ' ]';
            // v0.66: hide download button if all stations are already downloaded
            const dlBtn = document.getElementById('radio-dl-btn');
            if (dlBtn) {
                const allDownloaded = radioManifest.stations.every(st => radioDlState[st.id] || st.tracks.length === 0);
                dlBtn.style.display = allDownloaded ? 'none' : '';
            }
            renderRadioOverseer();
            updateHud(); // v0.56: header glyphs
        }

        function radioStationTap(sid) {
            const st = stationById(sid);
            if (!st) { showNotification('STATION LIST NOT LOADED YET -- CHECK SIGNAL.'); return; }
            if (st.tracks.length === 0) { showNotification('NO CONNECTION - STATION UNAVAILABLE'); return; }
            if (radioCur === sid) { radioStop(); return; } // tapping the live dial kills it
            radioCur = sid;
            if (radioIsSynced(sid)) {
                radioJoinLive(true); // v0.54: land on the same second of the same track as everyone
                // v0.56: no toast -- the HUD glyph + row badge carry the state (user cull)
            } else {
                // v0.56: free-run reshuffles every listen; resume memory stores the TRACK (mapped into the fresh order)
                delete radioOrder[sid];
                const order = radioOrderForSid(st, sid);
                const mem = radioPos[sid];
                const at = (mem != null && mem < st.tracks.length) ? order.indexOf(mem) : -1;
                radioTrackIdx = at >= 0 ? at : 0;
                radioStatic(420);
                radioPlayCurrent();
            }
            radioSyncWatchdog();
        }

        function radioPlayCurrent(startAt) {
            const st = stationById(radioCur);
            if (!st) return;
            const tr = radioTrackAt(st, radioCur, radioTrackIdx); // v0.56: shuffled order
            const now = document.getElementById('radio-now');
            const synced = radioIsSynced(radioCur); // v0.54
            radioAudio.src = trackUrl(st, tr);
            radioAudio.onloadedmetadata = synced ? () => {
                try {
                    const p = radioLivePos(radioCur); // re-derive AT load time -- buffering burned wall-clock
                    const want = (p && p.idx === radioTrackIdx) ? p.seek : (startAt || 0);
                    radioAudio.currentTime = Math.max(0, Math.min(want, (radioAudio.duration || want) - 0.25));
                } catch (e) {}
            } : null;
            radioAudio.onended = synced ? () => radioSyncBoundary(0)
                                        : () => { radioStatic(550); radioNext(); };
            radioAudio.onerror = () => {
                if (now) now.innerText = 'NO SIGNAL -- ' + st.name + ' NEEDS THE PACK ([⇩] BELOW) OR A LIVE LINK.';
            };
            radioAudio.play().catch(() => {});
            if (now) now.innerText = (synced ? 'LIVE · ' : '') + st.name + ' :: ' + tr.a + ' — ' + tr.t;
            renderRadioTab();
        }

        function radioNext() {
            const st = stationById(radioCur);
            if (!st) return;
            radioTrackIdx = (radioTrackIdx + 1) % st.tracks.length; // just looping (positions in the shuffle order)
            radioPos[radioCur] = radioOrderForSid(st, radioCur)[radioTrackIdx]; // v0.56: persist the TRACK, not the position
            saveRadioState();
            radioPlayCurrent();
        }
        function radioNextUi() {
            if (!radioCur) { showNotification('TUNE A STATION FIRST.'); return; }
            if (radioIsSynced(radioCur)) { showNotification('SYNC LOCKED -- THE OVERSEER RUNS THIS DIAL. (SYNC OFF FOR LOCAL CONTROL)'); return; } // v0.54
            radioStatic(300);
            radioNext();
        }

        function radioStop() {
            if (radioCur) delete radioAppliedEpoch[radioCur];
            radioCur = null;
            radioAudio.pause();
            if (radioSyncTimer) { clearInterval(radioSyncTimer); radioSyncTimer = null; } // v0.54
            const now = document.getElementById('radio-now');
            if (now) now.innerText = 'RADIO OFF';
            renderRadioTab();
        }

        // ==================== OVERSEER WIRE (v0.56) ====================
        // One-slot satellite board (announcements/latest {text<=140, from<=32, ts}): the
        // Overseer's voice onto every Pip-Boy. Own push switch (default ON), persistent
        // amber banner under the header until dismissed; 12h expiry; survives offline boot.
        let wireFirstSnap = true;
        let lastWireObj = null;
        function wireAlertsOn() { return localStorage.getItem('pipboy-wire-alerts') !== '0'; }
        function cycleWireAlerts() {
            const on = localStorage.getItem('pipboy-wire-alerts') === '0';
            localStorage.setItem('pipboy-wire-alerts', on ? '1' : '0');
            const b = document.getElementById('options-wire-btn');
            if (b) b.innerText = '[WIRE ALERTS: ' + (on ? 'ON' : 'OFF') + ']';
            showNotification('WIRE ALERTS ' + (on ? 'ON.' : 'OFF.'));
        }
        function startWireListener() {
            window.firebaseOnValue(window.firebaseRef(window.db, 'announcements/latest'), (snap) => {
                const w = snap.val();
                try { if (w && w.ts) localStorage.setItem('pipboy-wire-last', JSON.stringify(w)); } catch (e) {}
                const isFreshArrival = !wireFirstSnap && w && w.ts && (!lastWireObj || lastWireObj.ts !== w.ts);
                lastWireObj = w || null;
                updateWireBanner(lastWireObj);
                if (wireFirstSnap) { wireFirstSnap = false; return; } // boot sync isn't news
                if (isFreshArrival) {
                    showNotification('OVERSEER WIRE: ' + String(w.text || '').toUpperCase());
                    if (wireAlertsOn()) { try { pushNativeNotification('OVERSEER WIRE -- ' + String(w.text || '')); } catch (e) {} }
                }
            }, () => {});
        }
        function updateWireBanner(w) {
            const b = document.getElementById('wire-banner');
            if (!b) return;
            const dismissed = localStorage.getItem('pipboy-wire-dismissed') || '';
            const fresh = !!(w && w.ts && (Date.now() - w.ts) < 12 * 3600 * 1000);
            if (fresh && String(w.ts) !== dismissed) {
                document.getElementById('wire-banner-text').innerText = String(w.text || '').toUpperCase();
                b.style.display = 'block';
            } else {
                b.style.display = 'none';
            }
        }
        function dismissWire() {
            if (lastWireObj && lastWireObj.ts) localStorage.setItem('pipboy-wire-dismissed', String(lastWireObj.ts));
            const b = document.getElementById('wire-banner');
            if (b) b.style.display = 'none';
        }
        // Offline boot: paint the last wire from storage until the satellite answers.
        (function bootWireFromStorage() {
            try { const w = JSON.parse(localStorage.getItem('pipboy-wire-last') || 'null'); if (w && w.ts) { lastWireObj = w; updateWireBanner(w); } } catch (e) {}
            const b = document.getElementById('options-wire-btn');
            if (b && localStorage.getItem('pipboy-wire-alerts') === '0') b.innerText = '[WIRE ALERTS: OFF]';
        })();
        function sendWire() {
            const ta = document.getElementById('wire-text');
            const text = ((ta && ta.value) || '').trim().toUpperCase();
            if (!text) { showNotification('WIRE TEXT IS EMPTY.'); return; }
            if (text.length > 140) { showNotification('KEEP THE WIRE UNDER 140 CHARACTERS.'); return; }
            showCustomPrompt('TRANSMIT THIS WIRE TO EVERY PIP-BOY?\n\n"' + text + '"', [
                { label: 'TRANSMIT', color: '#ffb642', action: () => {
                    if (!window.db) { showNotification('NO SATELLITE LINK.'); return; }
                    window.firebaseSet(window.firebaseRef(window.db, 'announcements/latest'), {
                        text: text, from: (userProfile.name || 'OVERSEER').toUpperCase().slice(0, 32), ts: Date.now()
                    }).then(() => { showNotification('WIRE TRANSMITTED.'); const t2 = document.getElementById('wire-text'); if (t2) t2.value = ''; })
                      .catch(() => showNotification('WIRE REJECTED -- RULES NEED THE ANNOUNCEMENTS NODE (RULES PASTE STEP).'));
                }},
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        // ==================== RADIO SYNC ENGINE (v0.54) ====================
        // Live radio with zero servers: nobody broadcasts audio -- we sync PLAYHEADS. The
        // Overseer writes radio/{sid} {epoch}; every unit computes elapsed = serverNow - epoch,
        // walks the manifest durations (t.d, harvested from the ogg tails) and lands on the same
        // track at the same second. Accuracy ±2s via /.info/serverTimeOffset -- inaudible under
        // the AM static bed baked into every track. Off-air or SYNC OFF = v0.53 free-run loops.
        function radioServerNow() { return Date.now() + radioServerOffset; }
        function radioIsSynced(sid) {
            const st = stationById(sid);
            return !!(radioSyncOn && st && st.totalDur > 0 && radioLive[sid] && radioLive[sid].epoch);
        }
        function radioLivePos(sid) {
            const st = stationById(sid);
            const row = radioLive[sid];
            if (!st || !st.totalDur || !row || !row.epoch) return null;
            let el = ((radioServerNow() - row.epoch) / 1000) % st.totalDur;
            if (el < 0) el += st.totalDur;
            const order = radioOrderForSid(st, sid); // v0.56: same order on every synced unit
            let acc = 0;
            for (let i = 0; i < order.length; i++) {
                const d = st.tracks[order[i]].d || 0;
                if (el < acc + d) return { idx: i, seek: el - acc };
                acc += d;
            }
            return { idx: 0, seek: 0 };
        }
        // v0.56: SHUFFLED PLAYLISTS (user: "randomise, arcs mixed in"). Free-run reshuffles each
        // listen; SYNCED dials seed the shuffle from the broadcast epoch so every unit computes
        // the identical shuffled loop -- order walks, SKIP and boundaries all march in lockstep
        // (loop length is permutation-invariant). radioTrackIdx is an ORDER POSITION from here on.
        function radioSeededOrder(st, seed) {
            const idx = st.tracks.map((_, i) => i);
            let s = (seed >>> 0) || 1;
            const rnd = () => { // mulberry32
                s |= 0; s = (s + 0x6D2B79F5) | 0;
                let t = Math.imul(s ^ (s >>> 15), 1 | s);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
            for (let i = idx.length - 1; i > 0; i--) {
                const j = Math.floor(rnd() * (i + 1));
                const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
            }
            return idx;
        }
        function radioOrderForSid(st, sid) {
            if (radioIsSynced(sid)) return radioSeededOrder(st, radioLive[sid].epoch);
            if (!radioOrder[sid] || radioOrder[sid].length !== st.tracks.length) radioOrder[sid] = radioSeededOrder(st, Date.now() ^ Math.floor(Math.random() * 0xFFFFFF));
            return radioOrder[sid];
        }
        function radioTrackAt(st, sid, ordPos) { return st.tracks[radioOrderForSid(st, sid)[ordPos]]; }

        // Snap local state to the live playhead and play. withStatic = crackle flourish on a
        // manual tune or an overseer shift; boundary hops stay tight (static's baked into tracks).
        function radioJoinLive(withStatic) {
            const sid = radioCur;
            if (!sid || !radioIsSynced(sid)) return;
            const pos = radioLivePos(sid) || { idx: 0, seek: 0 };
            radioTrackIdx = pos.idx;
            radioPos[sid] = radioOrderForSid(stationById(sid), sid)[pos.idx]; // v0.56: persist the TRACK
            radioAppliedEpoch[sid] = radioLive[sid].epoch;
            saveRadioState();
            if (withStatic) radioStatic(420);
            radioPlayCurrent(pos.seek);
        }
        // A synced track ended -- the shared clock should be across the boundary too. If skew
        // says "not yet" (pos still inside the just-ended track), wait and re-eval a few times,
        // then give up and advance locally so the loop can never stall.
        function radioSyncBoundary(retry) {
            if (!radioCur || !radioIsSynced(radioCur)) return;
            const st = stationById(radioCur);
            const pos = radioLivePos(radioCur);
            if (!pos) return; // broadcast cut -- the radio/ listener handles the stop
            const endNear = ((radioTrackAt(st, radioCur, radioTrackIdx) || {}).d || 0) - 0.75; // v0.56: order position -> track
            if (pos.idx === radioTrackIdx && pos.seek > endNear) {
                if ((retry || 0) < 4) { setTimeout(() => radioSyncBoundary((retry || 0) + 1), 800); }
                else { radioNext(); }
                return;
            }
            radioTrackIdx = pos.idx;
            radioPos[radioCur] = radioOrderForSid(st, radioCur)[pos.idx]; // v0.56: persist the TRACK
            saveRadioState();
            radioPlayCurrent(pos.seek);
        }
        // 5s drift watchdog: full rejoin when the shared playhead is on another track (covers
        // overseer SKIP), hard punch only past 1.5s adrift so there's no constant micro-stutter.
        function radioSyncWatchdog() {
            if (radioSyncTimer) { clearInterval(radioSyncTimer); radioSyncTimer = null; }
            if (!radioCur || !radioIsSynced(radioCur)) return;
            radioSyncTimer = setInterval(() => {
                if (!radioCur || !radioIsSynced(radioCur)) { clearInterval(radioSyncTimer); radioSyncTimer = null; return; }
                const pos = radioLivePos(radioCur);
                if (!pos) return;
                if (pos.idx !== radioTrackIdx) { radioJoinLive(false); return; }
                try { if (Math.abs((radioAudio.currentTime || 0) - pos.seek) > 1.5) radioAudio.currentTime = pos.seek; } catch (e) {}
            }, 5000);
        }
        function radioSyncToggle() {
            radioSyncOn = !radioSyncOn;
            localStorage.setItem('pipboy-radio-sync', radioSyncOn ? 'on' : 'off');
            if (radioCur) radioStop(); // clean re-tune under the new mode
            renderRadioTab(); // v0.56: the button label + HUD glyph say it -- toast culled per user
        }
        // Satellite listeners; deferred until window.db exists (same retry shape as initComms).
        function initRadioSync(tries) {
            if (window.db && window.firebaseOnValue && window.firebaseRef) {
                startWireListener(); // v0.56: the Overseer wire rides the same db-ready gate
                window.firebaseOnValue(window.firebaseRef(window.db, '.info/serverTimeOffset'), (snap) => {
                    radioServerOffset = snap.val() || 0;
                }, () => {});
                window.firebaseOnValue(window.firebaseRef(window.db, 'radio/'), (snap) => {
                    radioLive = snap.val() || {};
                    if (radioCur) {
                        const row = radioLive[radioCur];
                        if (!row || !row.epoch) {
                            if (radioAppliedEpoch[radioCur]) { // we were synced: the dial went dark for everyone
                                radioStop();
                                showNotification('BROADCAST ENDED -- THE DIAL WENT DARK.');
                            }
                        } else if (radioSyncOn && radioAppliedEpoch[radioCur] !== undefined && radioAppliedEpoch[radioCur] !== row.epoch) {
                            radioJoinLive(true); // overseer SKIP / fresh GO LIVE shifted the playhead (no toast: the audio jump IS the notice)
                        }
                    }
                    renderRadioTab();
                }, () => {});
            } else if ((tries || 0) < 40) {
                setTimeout(() => initRadioSync((tries || 0) + 1), 2500);
            }
        }
        // --- OVERSEER BROADCAST DESK (dev-mode only; rides the same PIN/self-police trust model as radzones) ---
        function renderRadioOverseer() {
            const box = document.getElementById('radio-overseer');
            if (!box || !radioManifest) return;
            if (localStorage.getItem('pipboy-dev-mode') !== 'true') { box.style.display = 'none'; box.innerHTML = ''; return; }
            box.style.display = 'block';
            let h = '<div style="border: 1px dashed #ff3333; padding: 8px; margin: 12px 0; font-size: 0.8rem;">';
            h += '<div style="color: #ff3333; text-shadow: 0 0 5px #ff3333; margin-bottom: 6px;">== OVERSEER BROADCAST DESK ==</div>';
            radioManifest.stations.forEach(st => {
                const live = !!(radioLive[st.id] && radioLive[st.id].epoch);
                const pos = live ? radioLivePos(st.id) : null;
                h += '<div style="display: flex; align-items: center; gap: 6px; margin: 5px 0; flex-wrap: wrap;">';
                h += '<span style="flex: 1; min-width: 100px; font-size: 0.75rem;">' + st.name + '</span>';
                if (live && pos) {
                    h += '<span style="color: #ffb642; font-size: 0.7rem;">ON AIR · TRK ' + (pos.idx + 1) + '/' + st.tracks.length + '</span>';
                    h += '<button class="pip-btn" style="padding: 2px 6px; font-size: 0.7rem; width: auto;" onclick="radioOverseerSkip(\'' + st.id + '\')">[▶▶ SKIP]</button>';
                    h += '<button class="pip-btn" style="padding: 2px 6px; font-size: 0.7rem; width: auto; border-color: #ff3333; color: #ff3333;" onclick="radioOverseerCut(\'' + st.id + '\')">[◼ CUT]</button>';
                } else {
                    h += '<span style="opacity: 0.55; font-size: 0.7rem;">OFF AIR</span>';
                    h += '<button class="pip-btn" style="padding: 2px 6px; font-size: 0.7rem; width: auto;" onclick="radioOverseerOnAir(\'' + st.id + '\')">[● GO LIVE]</button>';
                }
                h += '</div>';
            });
            h += '<div style="opacity: 0.55; font-size: 0.7rem; margin-top: 4px;">EVERY SYNCED UNIT HEARS THE SAME TRACK AT THE SAME SECOND (±2S). CUT SETS THE DIAL DARK FOR EVERYONE.</div>';
            h += '</div>';
            box.innerHTML = h;
        }
        function radioWriteEpoch(sid, epoch) {
            if (!window.db) { showNotification('NO SATELLITE LINK.'); return; }
            window.firebaseSet(window.firebaseRef(window.db, 'radio/' + sid), { epoch: epoch })
                .then(() => { renderRadioTab(); })
                .catch(() => showNotification('BROADCAST WRITE REJECTED -- RADIO NODE MISSING FROM RULES (DO THE RULES PASTE).'));
        }
        function radioOverseerOnAir(sid) {
            const st = stationById(sid);
            if (!st) return;
            showCustomPrompt('GO LIVE ON ' + st.name + '? EVERY UNIT WITH STATION SYNC ON HEARS THIS DIAL FROM TRACK 1, TOGETHER (±2S).', [
                { label: 'GO LIVE', action: () => radioWriteEpoch(sid, radioServerNow()) },
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }
        function radioOverseerSkip(sid) {
            const st = stationById(sid);
            const pos = radioLivePos(sid);
            if (!st || !pos) return;
            const order = radioOrderForSid(st, sid); // v0.56: the SHARED shuffled order (epoch-seeded)
            let acc = 0; // loop-seconds through the END of the current track = next track's start
            for (let i = 0; i <= pos.idx; i++) acc += (st.tracks[order[i]].d || 0);
            acc = acc % st.totalDur;
            radioWriteEpoch(sid, radioServerNow() - Math.round(acc * 1000));
        }
        function radioOverseerCut(sid) {
            const st = stationById(sid);
            if (!st) return;
            showCustomPrompt('CUT ' + st.name + ' BROADCAST? EVERY SYNCED UNIT ON THIS DIAL GOES SILENT.', [
                { label: 'CUT BROADCAST', color: '#ff3333', action: () => {
                    if (!window.db) { showNotification('NO SATELLITE LINK.'); return; }
                    window.firebaseRemove(window.firebaseRef(window.db, 'radio/' + sid))
                        .then(() => {})
                        .catch(() => showNotification('CUT REJECTED -- CHECK RULES.'));
                } },
                { label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} }
            ]);
        }

        // Short synthesized static burst (bandpassed brown noise; no audio file needed).
        let _radioAc = null;
        function radioStatic(ms) {
            try {
                if (!_radioAc) _radioAc = new (window.AudioContext || window.webkitAudioContext)();
                const ac = _radioAc;
                if (ac.state === 'suspended') ac.resume();
                const dur = Math.max(0.15, (ms || 500) / 1000);
                const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
                const ch = buf.getChannelData(0);
                let last = 0;
                for (let i = 0; i < ch.length; i++) {
                    const w = Math.random() * 2 - 1;
                    last = (last + 0.02 * w) / 1.02;  // brown-ish
                    ch[i] = last * 3.5;
                }
                const src = ac.createBufferSource(); src.buffer = buf;
                const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.4;
                const g = ac.createGain(); g.gain.value = 0.45;
                src.connect(bp); bp.connect(g); g.connect(ac.destination);
                src.start();
            } catch (e) {}
        }

        // --- DOWNLOADER (bottom button + themed size-confirm popup, user's spec) ---
        function radioDownloadMenu() {
            if (radioDlRunning) { radioDlStop = true; return; } // button doubles as STOP
            if (!radioManifest) { showNotification('STATION LIST NOT LOADED YET -- CHECK SIGNAL.'); return; }
            const sum = st => st.tracks.reduce((a, t) => a + t.b, 0);
            const mb = b => '≈' + (b / 1048576).toFixed(1) + 'MB';
            const missing = radioManifest.stations.filter(s => !radioDlState[s.id]);
            if (!missing.length) { showNotification('ALL STATIONS ALREADY ONBOARD.'); return; }
            const totalTracks = missing.reduce((a, s) => a + s.tracks.length, 0);
            const totalBytes = missing.reduce((a, s) => a + sum(s), 0);
            const btns = [{
                label: 'ALL STATIONS ' + mb(totalBytes),
                action: () => radioDownload(missing.map(s => s.id))
            }];
            missing.forEach(s => {
                btns.push({ label: s.name + ' ' + mb(sum(s)), action: () => radioDownload([s.id]) });
            });
            btns.push({ label: 'CANCEL', color: 'var(--pip-color-dim)', action: () => {} });
            showCustomPrompt(
                'RADIO CONTENT -- ' + totalTracks + ' TRANSMISSIONS ' + mb(totalBytes) + ' STILL TO COME. DOWNLOAD OVER WIFI; THE PACK CACHES ON THIS UNIT AND PLAYS OFFLINE FOREVER.',
                btns);
        }

        async function radioDownload(sids) {
            const status = document.getElementById('radio-dl-status');
            const btn = document.getElementById('radio-dl-btn');
            radioDlRunning = true; radioDlStop = false;
            if (btn) btn.innerText = '[■ STOP DOWNLOAD]';
            let failed = 0, finishedAll = true;
            try {
                const cache = await caches.open(RADIO_CACHE);
                for (const sid of sids) {
                    const st = stationById(sid);
                    if (!st) continue;
                    let stationFailed = 0;
                    for (let i = 0; i < st.tracks.length; i++) {
                        if (radioDlStop) { finishedAll = false; break; }
                        if (!navigator.onLine) { finishedAll = false; break; }
                        const tr = st.tracks[i];
                        if (status) status.innerText = 'DOWNLOADING ' + st.name + ' · ' + (i + 1) + '/' + st.tracks.length + ' · ' + tr.t.substring(0, 22);
                        const url = trackUrl(st, tr);
                        try {
                            if (await cache.match(url)) continue; // resume-safe: skip what's aboard
                            const resp = await fetch(url);
                            if (!resp || !resp.ok) throw new Error('http');
                            const blob = await resp.blob();
                            await cache.put(url, new Response(blob, { headers: { 'Content-Type': 'audio/ogg' } }));
                        } catch (e) {
                            failed++; stationFailed++;
                        }
                    }
                    if (radioDlStop || !navigator.onLine) { finishedAll = false; break; }
                    if (!stationFailed) { radioDlState[sid] = true; saveRadioState(); }
                }
            } catch (e) { finishedAll = false; }
            radioDlRunning = false;
            renderRadioTab();
            if (btn) btn.innerText = '[⇩ DOWNLOAD RADIO CONTENT]';
            if (status) {
                status.innerText = failed ? (failed + ' TRACKS FAILED -- TAP [⇩] AGAIN TO RESUME/RETRY.')
                    : (finishedAll ? 'REQUESTED STATIONS ONBOARD. OFFLINE-READY.'
                    : (navigator.onLine ? 'DOWNLOAD STOPPED.' : 'SIGNAL LOST -- RESUME LATER OVER WIFI.'));
            }
            showNotification(failed ? 'RADIO DOWNLOAD: ' + failed + ' FAILURES -- RESUME FROM [⇩].'
                : (finishedAll ? 'RADIO PACK ONBOARD.' : 'RADIO DOWNLOAD STOPPED.'));
        }


        renderMailBadge();
        recomputeSpecial(); // v0.58: apply any saved mutations to S.P.E.C.I.A.L. before first render
        hydrateLastFix(); // v0.56: self-dot from the persisted fix, even before GPS arms
        initComms();
        initRadio();      // v0.53: load the three-dial manifest + download badges
        maybeAutoGps(); // v0.52: GPS is on-until-turned-off -- silently re-arm if it was left on
        updateHud();    // v0.56: header glyphs paint at boot

        // ==================== PWA INSTALL PIPELINE (v0.32) ====================
        // Root cause of "install did nothing on Chrome": the WebAPK minting pipeline is
        // silent and slow (up to a minute), AND our manifest under-declared icons
        // (single entry, mislabeled 512 while the file was 1024) suppressed Chrome's
        // automatic install surfaces. Now fixed at the manifest, and this button gives
        // one-tap install where the browser offers it, clear instructions elsewhere.
        let deferredInstallPrompt = null;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault(); // we surface OUR pre-boot button instead of the mini-infobar
            deferredInstallPrompt = e;
            updateInstallBtn();
        });
        window.addEventListener('appinstalled', () => {
            deferredInstallPrompt = null;
            updateInstallBtn();
            showNotification('POX-BOY INSTALLED. LAUNCH THE HOME SCREEN ICON FOR FULL IMMERSION.');
        });
        function isIOSDevice() {
            return /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
                (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
        }
        function updateInstallBtn() {
            const btn = document.getElementById('pb-install-btn');
            if (!btn) return;
            // Meaningless once installed (WebAPK standalone/fullscreen, or iOS home screen)
            if (getDisplayMode() !== 'browser') { btn.style.display = 'none'; return; }
            // v0.63: hide if user chose "USE IN BROWSER"
            if (localStorage.getItem('pipboy-install-dismissed') === 'true') { btn.style.display = 'none'; return; }
            btn.style.display = '';
        }
        async function installApp() {
            if (deferredInstallPrompt) {
                // v0.63: custom prompt before native install dialog
                showCustomPrompt('INSTALL POX-BOY 3026 AS STANDALONE APP?', [
                    { label: 'INSTALL APP', action: async () => {
                        try {
                            deferredInstallPrompt.prompt();
                            const choice = await deferredInstallPrompt.userChoice.catch(() => null);
                            if (choice && choice.outcome === 'accepted') {
                                showNotification('INSTALL ACCEPTED. THE APP ICON CAN TAKE UP TO A MINUTE TO APPEAR ON YOUR HOME SCREEN — THAT WAIT IS NORMAL.');
                            }
                        } catch (e) {}
                        deferredInstallPrompt = null;
                        updateInstallBtn();
                    }},
                    { label: 'USE IN BROWSER', color: 'var(--pip-color-dim)', action: () => {
                        localStorage.setItem('pipboy-install-dismissed', 'true');
                        updateInstallBtn();
                    }}
                ]);
                return;
            }
            // No capturable prompt available: hand-hold through the manual route
            if (isIOSDevice()) {
                showNotification('iOS INSTALL: TAP SAFARI\'S SHARE ICON, THEN "ADD TO HOME SCREEN", THEN LAUNCH THE POX-BOY ICON.');
            } else {
                showNotification('MANUAL INSTALL: TAP THE BROWSER MENU (⋮) THEN "INSTALL APP" / "ADD TO HOME SCREEN". THE NEW ICON MAY TAKE A MINUTE TO APPEAR — WAIT FOR IT.');
            }
        }

        // ---- HEADER BATTERY METER (Android/Chrome only; hidden where unsupported) ----
        function initBattMeter() {
            const el = document.getElementById('pip-batt');
            if (!el) return;
            if (!('getBattery' in navigator)) { el.style.display = 'none'; return; }
            navigator.getBattery().then(b => {
                el.style.display = 'block';
                const upd = () => { el.innerText = 'PWR ' + Math.round(b.level * 100) + '%' + (b.charging ? '+' : ''); };
                upd();
                b.addEventListener('levelchange', upd);
                b.addEventListener('chargingchange', upd);
            }).catch(() => { el.style.display = 'none'; });
        }

        updateInstallBtn();
        initBattMeter();

        renderQuests();
        initOnboarding();
