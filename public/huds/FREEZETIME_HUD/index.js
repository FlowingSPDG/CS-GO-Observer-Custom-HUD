const SlotSide = {
    left: "left",
    right: "right",
};
const reverseSlotSide = function (slotSide) {
  return slotSide === SlotSide.left
      ? SlotSide.right
      : SlotSide.left
};
const getSlotSide = function (observerSlot) {
    return observerSlot !== 0 && observerSlot <= 5
        ? SlotSide.left
        : SlotSide.right;
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
        const $img = $("<img />");
        $img.attr("src", roundWinIconMap[reason]);
        return $img;
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

            const isFirstHalf = data.map().round <= 15;

            // 15ラウンド終了直後および16ラウンド目は 1ST HALF の表示のまま更新しない.
            if (previousRound === 15 && data.map().round === 15) {
                return;
            }

            updateRoundLabel(isFirstHalf);

            $roundHistory.each(function (index, element) {
                const $element = $(element);
                const round = isFirstHalf ? index + 1 : index + 16; // セカウンドハーフでは 16 からスタート

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

function updatePage(data) {
    updateRoundWinPanel(data);
}