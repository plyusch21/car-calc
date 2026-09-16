# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (2975 строк)

### Секции

- L420-662: 1. Default configuration
- L663-695: 2. State
- L696-765: 3. Helpers
- L766-922: 4. Currency rates — fetch via server-side proxy, manual always wins
- L923-931: 5. Delivery lookup
- L932-944: 6. Route → RUB conversion chains
- L945-975: 7. Main calculation
- L976-2309: 8. Rendering
- L2310-2655: 9. Settings
- L2656-2787: 10. Rate editor sheet
- L2788-2832: 11. Nav + boot
- L2833-2975: 12. Доступ через Telegram — приложение работает только как Mini App.

### Функции

- L387-395: `saveDeliveryPrefs()`
- L396-418: `loadDeliveryPrefsFromCloud()`
- L529-548: `mergeRatesState()`
- L555-566: `mergeRoutesState()`
- L567-572: `applyStoredConfig()`
- L585-585: `getInitData()`
- L586-586: `getTg()`
- L590-598: `tgHaptic()`
- L604-607: `formHasData()`
- L608-613: `updateClosingGuard()`
- L622-635: `saveConfig()`
- L636-641: `saveHistory()`
- L646-651: `saveArchive()`
- L652-661: `deepMerge()`
- L668-683: `defaultForm()`
- L703-703: `groupInt()`
- L704-708: `fmt()`
- L709-709: `num()`
- L716-721: `invalidateCustomsAuto()`
- L727-735: `computeAgeFromDate()`
- L740-743: `applyAgeFromDate()`
- L747-753: `formatNumInput()`
- L754-754: `cleanNumInput()`
- L760-760: `escapeHtml()`
- L761-764: `openExternal()`
- L779-784: `logRateHistory()`
- L786-811: `applyAutoRate()`
- L813-845: `fetchAutoRates()`
- L854-903: `fetchCustomsQuote()`
- L905-913: `setRawValue()`
- L915-921: `clearManualOverride()`
- L926-930: `deliveryPrice()`
- L935-943: `convertToRub()`
- L948-974: `calcDeal()`
- L1016-1022: `rateWidgetData()`
- L1023-1027: `isUpdatedToday()`
- L1032-1036: `rateWidgetStatus()`
- L1037-1049: `rateWidgetHtml()`
- L1052-1059: `bindRateWidget()`
- L1064-1073: `refreshRatesUI()`
- L1078-1087: `fetchCbrReference()`
- L1089-1095: `cbrReferenceHtml()`
- L1097-1129: `openRatesSheet()`
- L1134-1148: `ratesPreviewCardHtml()`
- L1150-1168: `renderTabs()`
- L1170-1175: `renderContent()`
- L1177-1177: `field()`
- L1178-1178: `removeFromArr()`
- L1183-1185: `carriedHint()`
- L1189-1193: `unfilledHint()`
- L1194-1194: `unfilledClass()`
- L1198-1204: `clearFieldHints()`
- L1206-1208: `cityOptions()`
- L1213-1252: `resizeImageToBase64()`
- L1270-1326: `runListingParse()`
- L1328-1624: `renderCalc()`
- L1626-1642: `carDetailLines()`
- L1647-1651: `pushArchive()`
- L1652-1780: `showResult()`
- L1784-1786: `fmtRate()`
- L1795-1913: `buildKpHtml()`
- L1918-1949: `renderKpImageBlob()`
- L1966-2112: `shareResult()`
- L2123-2165: `bindHistorySwipe()`
- L2167-2183: `openClearHistoryConfirm()`
- L2185-2207: `openOtherRoutePicker()`
- L2214-2236: `renderArchiveList()`
- L2238-2308: `renderHistory()`
- L2325-2385: `renderSettingsView()`
- L2387-2403: `openResetConfirm()`
- L2405-2408: `fetchAdminUsers()`
- L2409-2412: `adminAction()`
- L2419-2446: `renderAdminUsersList()`
- L2447-2467: `loadAdminCard()`
- L2479-2487: `fetchDealsApi()`
- L2488-2508: `loadDealsExtraCard()`
- L2509-2525: `openDealsArchiveSheet()`
- L2526-2526: `csvCellIdx()`
- L2527-2527: `idleDaysIdx()`
- L2528-2537: `dealsCsvIdx()`
- L2538-2548: `partiesCsvIdx()`
- L2549-2592: `runDealsExport()`
- L2593-2611: `openWipeDealersConfirm()`
- L2613-2623: `routeSettingsBlock()`
- L2624-2633: `bindRouteSettings()`
- L2635-2644: `deliveryTable()`
- L2645-2654: `bindDeliveryTable()`
- L2659-2659: `openSheet()`
- L2660-2660: `closeSheet()`
- L2665-2683: `openTextFieldSheet()`
- L2729-2747: `openRateHistory()`
- L2749-2786: `openRateEditor()`
- L2812-2812: `toast()`
- L2822-2829: `syncTelegramUI()`
- L2830-2830: `renderAll()`
- L2831-2831: `startApp()`
- L2841-2855: `renderGate()`
- L2857-2969: `bootGate()`


## deals.html (1334 строк)

### Секции

- L179-252: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L253-360: 2. Утилиты и состояние
- L361-606: 3. Экран списка
- L607-819: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L820-1211: 5. Карточка сделки
- L1212-1276: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1277-1334: 8. Загрузка и гейт

### Функции

- L216-216: `stagesOf()`
- L223-231: `currentStage()`
- L232-232: `stageState()`
- L233-236: `isArchived()`
- L240-247: `lastMovementAt()`
- L248-251: `idleDays()`
- L268-268: `onlyDigits()`
- L269-272: `formatDivisionCode()`
- L273-280: `formatSnils()`
- L281-297: `formatPhoneRu()`
- L300-304: `bindMask()`
- L308-314: `formatDateDdMmYyyy()`
- L317-320: `formatMoney()`
- L321-324: `tsToDdMmYyyy()`
- L328-335: `parseDdMmYyyy()`
- L336-336: `toast()`
- L337-337: `openSheet()`
- L338-338: `closeSheet()`
- L341-341: `initData()`
- L343-351: `api()`
- L353-359: `pluralDays()`
- L372-413: `bindDealSwipe()`
- L415-432: `openDeleteDealConfirm()`
- L436-469: `dealRowsHtml()`
- L470-484: `bindDealRows()`
- L486-486: `activeDealsOf()`
- L488-497: `renderList()`
- L501-501: `selectTab()`
- L511-531: `renderFlatDeals()`
- L533-541: `renderArchiveList()`
- L546-580: `renderDealerFolders()`
- L582-602: `renderDealerFolder()`
- L605-605: `auth_isRestricted()`
- L616-643: `openNewDealSheet()`
- L650-667: `askSamePerson()`
- L672-803: `openPartySheet()`
- L805-818: `createDeal()`
- L823-830: `openDeal()`
- L832-962: `renderDeal()`
- L966-1023: `openStageSheet()`
- L1025-1040: `openProblemSheet()`
- L1042-1113: `openDealEditSheet()`
- L1118-1134: `saveDeal()`
- L1139-1149: `loadCalcHistory()`
- L1151-1191: `openCalcPicker()`
- L1194-1210: `calcFillsForDeal()`
- L1216-1275: `openParty()`
- L1280-1286: `reloadIndexes()`
- L1294-1297: `gate()`
- L1299-1328: `boot()`
