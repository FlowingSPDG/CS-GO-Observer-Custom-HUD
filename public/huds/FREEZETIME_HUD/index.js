const SlotSide = {
    left: "left",
    right: "right",
};

const getSlotSide = function (observerSlot) {
    return observerSlot !== 0 && observerSlot <= 5
        ? SlotSide.left
        : SlotSide.right;
};

const createImageElement = function (src, className) {
    const $img = $("<img />");
    $img.attr("src", src);
    $img.addClass(className);
    return $img
};

const updateRoundWinPanel = (function () {
    const $roundHistoryPanel = $("#round_history_panel");
    const $round = $roundHistoryPanel.find("#ordinal_number");
    const $roundHistory = $roundHistoryPanel.find("#round_history").children("li");

    const updateRoundLabel = function (isFirstHalf) {
        $round.text(isFirstHalf ? "1ST" : "2ND");
    };

    const getRoundWinIcon = function (reason) {
        const basePath = "/huds/FREEZETIME_HUD/img/round";
        const roundWinIconMap = {
            "ct_win_elimination": `${basePath}/ct/kill.png`,
            "t_win_elimination": `${basePath}/t/kill.png`,
            "t_win_bomb": `${basePath}/exploded.png`,
            "ct_win_defuse": `${basePath}/defused.png`,
            "ct_win_time": `${basePath}/time.png`,
        };
        return createImageElement(roundWinIconMap[reason], reason);
    };

    let previousRoundWins = {};
    let previousRound = undefined;
    return function (data) {
        const roundWins = {...data.map().round_wins};
        // パフォーマンスに配慮し, roundWins が変動した場合のみ画面更新をかける
        if (JSON.stringify(previousRoundWins) !== JSON.stringify(roundWins)) {
            if (!roundWins) {
                $roundHistory.each(function (index, element) {
                    const $element = $(element);
                    $element.find(".round").text(index + 1);
                    $element.find(".left").html("");
                    $element.find(".right").html("");
                });
                return;
            }

            const shouldShowFirstHalfPanel = data.map().round <= 15; // 16ラウンド目終了時までは 1st half 表示

            updateRoundLabel(shouldShowFirstHalfPanel);

            $roundHistory.each(function (index, element) {
                const $element = $(element);
                const round = shouldShowFirstHalfPanel ? index + 1 : index + 16; // セカウンドハーフでは 16 からスタート

                // ラウンド数のラベル更新.
                $element.find(".round").text(round);

                const roundWinnerReason = roundWins[round.toString()];
                if (roundWinnerReason) {
                    const $roundWinIcon = getRoundWinIcon(roundWinnerReason);
                    const ctSlotSide = data.getCT().players.length !== 0
                        ? getSlotSide(data.getCT().players[0].observer_slot)
                        : SlotSide.left;
                    const isCtWin = roundWinnerReason.startsWith("ct_");
                    const isTWin = roundWinnerReason.startsWith("t_");

                    // データ不備の場合
                    if (!isCtWin && !isTWin) {
                        $element.find(".left").html("");
                        $element.find(".right").html("");
                        return;
                    }

                    if (ctSlotSide === SlotSide.left) {
                        $element.find(".left").html(isCtWin ? $roundWinIcon : "");
                        $element.find(".right").html(isCtWin ? "" : $roundWinIcon);
                    } else if (ctSlotSide === SlotSide.right) {
                        $element.find(".left").html(isCtWin ? "" : $roundWinIcon);
                        $element.find(".right").html(isCtWin ? $roundWinIcon : "");
                    }
                } else { // まだ行っていないラウンドなど,該当ラウンドの勝者の情報がない場合
                    $element.find(".left").html("");
                    $element.find(".right").html("");
                }

            });
        }
        previousRoundWins = roundWins;
        previousRound = data.map().round;
    };
})();

const updateTeamInfoPanel = (function () {
    const $teamInfoPanel = $("#team_info_panel");
    const $scoreBar = $teamInfoPanel.find("#score_bar");
    const $team1ScoreBar = $scoreBar.find(".team1");
    const $team2ScoreBar = $scoreBar.find(".team2");

    const $teamMoneyPanel = $("#team_money_panel");
    const $team1MoneyPanel = $teamMoneyPanel.children(".team1").children("li");
    const $team2MoneyPanel = $teamMoneyPanel.children(".team2").children("li");

    const $centerPanel = $(".center_panel");
    const $team1CenterPanel = $centerPanel.children(".team1");
    const $team2CenterPanel = $centerPanel.children(".team2");

    const updateTeamScore = function (data, $scoreBarElement, team, slotSide) {
        const player = data.getPlayer(slotSide === SlotSide.left ? 1 : 6);
        const teamName = team ? team.team_name : `TEAM${slotSide === slotSide.left ? 1 : 2}`;
        if (!player) {
            $scoreBarElement.children(".name").text(teamName);
            $scoreBarElement.children(".score").text("0");
            return;
        }
        const teamScore = player.team === "CT" ? data.getCT().score : data.getT().score;

        $scoreBarElement.attr("data-team", player.team); // T/CT
        $scoreBarElement.children(".name").text(teamName);
        $scoreBarElement.children(".score").text(teamScore);
    };

    const isPrimary = (weaponType) => [
        "Rifle",
        "SniperRifle",
        "Shotgun",
        "Machine Gun",
        "Submachine Gun",
    ].indexOf(weaponType) !== -1;
    const isSecondary = (weaponType) => weaponType === "Pistol";
    const isGrenade = (weaponType) => weaponType === "Grenade";

    const parseWeapons = function (weapons) {
        let primaryWeaponName = null;
        let secondaryWeaponName = null;
        let highExplosiveAmount = 0;
        let flashBangAmount = 0;
        let smokeAmount = 0;
        let molotovAmount = 0;
        let incGrenadeAmount = 0;
        let decoyAmount = 0;
        for (let slot of Object.keys(weapons)) {
            const weapon = weapons[slot];
            if (isPrimary(weapon.type)) {
                primaryWeaponName = weapon.name.replace("weapon_", "");
            } else if (isSecondary(weapon.type)) {
                secondaryWeaponName = weapon.name.replace("weapon_", "");
            } else if (isGrenade(weapon.type)) {
                if (weapon.name === "weapon_hegrenade") {
                    highExplosiveAmount = weapon.ammo_reserve;
                } else if (weapon.name === "weapon_molotov") {
                    molotovAmount = weapon.ammo_reserve;
                } else if (weapon.name === "weapon_flashbang") {
                    flashBangAmount = weapon.ammo_reserve;
                } else if (weapon.name === "weapon_decoy") {
                    decoyAmount = weapon.ammo_reserve;
                } else if (weapon.name === "weapon_smokegrenade") {
                    smokeAmount = weapon.ammo_reserve;
                } else if (weapon.name === "weapon_incgrenade") {
                    incGrenadeAmount = weapon.ammo_reserve;
                }
            }
        }
        const baseImagePath = "/files/img";
        const weaponImages = [];
        if (primaryWeaponName) {
            weaponImages.push(createImageElement(`${baseImagePath}/weapons/${primaryWeaponName}.png`, "primary"));
        }
        if (secondaryWeaponName) {
            weaponImages.push(createImageElement(`${baseImagePath}/weapons/${secondaryWeaponName}.png`, "secondary"));
        }

        [...Array(highExplosiveAmount)].forEach(() => {
            weaponImages.push(createImageElement(`${baseImagePath}/grenades/weapon_hegrenade.png`, "grenade"));
        });
        [...Array(flashBangAmount)].forEach(() => {
            weaponImages.push(createImageElement(`${baseImagePath}/grenades/weapon_flashbang.png`, "grenade"));
        });
        [...Array(smokeAmount)].forEach(() => {
            weaponImages.push(createImageElement(`${baseImagePath}/grenades/weapon_smokegrenade.png`, "grenade"));
        });
        [...Array(molotovAmount)].forEach(() => {
            weaponImages.push(createImageElement(`${baseImagePath}/grenades/weapon_molotov.png`, "grenade"));
        });
        [...Array(incGrenadeAmount)].forEach(() => {
            weaponImages.push(createImageElement(`${baseImagePath}/grenades/weapon_incgrenade.png`, "grenade"));
        });
        [...Array(decoyAmount)].forEach(() => {
            weaponImages.push(createImageElement(`${baseImagePath}/grenades/weapon_decoy.png`, "grenade"));
        });
        return weaponImages;
    };
    const parseArmor = function (stats) {
        const baseImagePath = "/files/img";
        if (stats.helmet) {
            return createImageElement(`${baseImagePath}/helmet.png`, "armor");
        }
        if (stats.armor > 0) {
            return createImageElement(`${baseImagePath}/armor.png`, "armor");
        }
        return null;
    };
    const updateTeamMoneyPanel = function (team) {
        if (team.players && team.players.length > 0) {
            const slotSide = getSlotSide(team.players[0].observer_slot);
            const $teamCenterPanel = slotSide === SlotSide.left ? $team1CenterPanel : $team2CenterPanel;
            $teamCenterPanel.children(".equipment_value").children("span").text(`$${team.equip_value}`);
            $teamCenterPanel.children(".team_money").children("span").text(`$${team.team_money}`);
            const $panel = slotSide === SlotSide.left ? $team1MoneyPanel : $team2MoneyPanel;
            $panel.each(function (index, target) {
                const $target = $(target);
                const player = team.players[index];
                if (player) {
                    $panel.attr("data-team", player.team);
                    $target.children(".name").text(player.name);
                    $target.children(".money").text(`$${player.state.money}`);

                    const weapons = parseWeapons(player.getWeapons());
                    const armor = parseArmor(player.getStats());
                    let html = "";
                    weapons.forEach($element => html += $element[0].outerHTML);
                    if (armor) {
                        html += armor[0].outerHTML;
                    }
                    if ($target.children(".weapons")[0].innerHTML !== html) {
                        $target.children(".weapons").html(html);
                    }
                } else {
                    $target.children(".name").text("");
                    $target.children(".money").text("");
                    $target.children(".weapons").html("");
                }
            });
        }
    };
    return function (data) {
        updateTeamScore(data, $team1ScoreBar, data.getTeamOne(), SlotSide.left);
        updateTeamScore(data, $team2ScoreBar, data.getTeamTwo(), SlotSide.right);
        updateTeamMoneyPanel(data.getCT());
        updateTeamMoneyPanel(data.getT());
    };
})();

function updatePage(data) {
    updateRoundWinPanel(data);
    updateTeamInfoPanel(data);
}