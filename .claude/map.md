# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (3027 строк)

### Секции

- L605-694: 1. Default configuration
- L695-723: 2. State
- L724-793: 3. Helpers
- L794-919: 4. Currency rates — fetch via server-side proxy, manual always wins
- L920-924: 5. Delivery lookup
- L925-929: 6. Route → RUB conversion chains
- L930-940: 7. Main calculation
- L941-2312: 8. Rendering
- L2313-2704: 9. Settings
- L2705-2836: 10. Rate editor sheet
- L2837-2881: 11. Nav + boot
- L2882-3027: 12. Доступ через Telegram — приложение работает только как Mini App.

### Функции

- L572-580: `saveDeliveryPrefs()`
- L581-603: `loadDeliveryPrefsFromCloud()`
- L614-614: `applyStoredConfig()`
- L627-627: `getInitData()`
- L628-628: `getTg()`
- L632-640: `tgHaptic()`
- L646-649: `formHasData()`
- L650-655: `updateClosingGuard()`
- L664-677: `saveConfig()`
- L678-683: `saveHistory()`
- L688-693: `saveArchive()`
- L700-715: `defaultForm()`
- L731-731: `groupInt()`
- L732-736: `fmt()`
- L737-737: `num()`
- L744-749: `invalidateCustomsAuto()`
- L755-763: `computeAgeFromDate()`
- L768-771: `applyAgeFromDate()`
- L775-781: `formatNumInput()`
- L782-782: `cleanNumInput()`
- L788-788: `escapeHtml()`
- L789-792: `openExternal()`
- L807-812: `logRateHistory()`
- L814-839: `applyAutoRate()`
- L841-873: `fetchAutoRates()`
- L882-900: `fetchCustomsQuote()`
- L902-910: `setRawValue()`
- L912-918: `clearManualOverride()`
- L923-923: `deliveryPrice()`
- L928-928: `convertToRub()`
- L938-938: `lockedRates()`
- L939-939: `calcDeal()`
- L981-990: `rateWidgetData()`
- L991-995: `isUpdatedToday()`
- L1000-1004: `rateWidgetStatus()`
- L1005-1020: `rateWidgetHtml()`
- L1024-1032: `bindRateWidget()`
- L1037-1046: `refreshRatesUI()`
- L1051-1060: `fetchCbrReference()`
- L1062-1068: `cbrReferenceHtml()`
- L1070-1102: `openRatesSheet()`
- L1107-1121: `ratesPreviewCardHtml()`
- L1123-1141: `renderTabs()`
- L1145-1159: `renderTopbar()`
- L1161-1167: `renderContent()`
- L1169-1169: `field()`
- L1170-1170: `removeFromArr()`
- L1175-1177: `carriedHint()`
- L1181-1185: `unfilledHint()`
- L1186-1186: `unfilledClass()`
- L1190-1196: `clearFieldHints()`
- L1198-1200: `cityOptions()`
- L1205-1244: `resizeImageToBase64()`
- L1262-1318: `runListingParse()`
- L1320-1616: `renderCalc()`
- L1618-1635: `carDetailLines()`
- L1640-1644: `pushArchive()`
- L1645-1781: `showResult()`
- L1785-1787: `fmtRate()`
- L1796-1914: `buildKpHtml()`
- L1919-1950: `renderKpImageBlob()`
- L1967-2113: `shareResult()`
- L2124-2166: `bindHistorySwipe()`
- L2168-2184: `openClearHistoryConfirm()`
- L2186-2208: `openOtherRoutePicker()`
- L2215-2238: `renderArchiveList()`
- L2240-2311: `renderHistory()`
- L2331-2398: `renderSettingsView()`
- L2404-2416: `themeSettingsCard()`
- L2417-2430: `bindThemeSettings()`
- L2436-2452: `openResetConfirm()`
- L2454-2457: `fetchAdminUsers()`
- L2458-2461: `adminAction()`
- L2468-2495: `renderAdminUsersList()`
- L2496-2516: `loadAdminCard()`
- L2528-2536: `fetchDealsApi()`
- L2537-2557: `loadDealsExtraCard()`
- L2558-2574: `openDealsArchiveSheet()`
- L2575-2575: `csvCellIdx()`
- L2576-2576: `idleDaysIdx()`
- L2577-2586: `dealsCsvIdx()`
- L2587-2597: `partiesCsvIdx()`
- L2598-2641: `runDealsExport()`
- L2642-2660: `openWipeDealersConfirm()`
- L2662-2672: `routeSettingsBlock()`
- L2673-2682: `bindRouteSettings()`
- L2684-2693: `deliveryTable()`
- L2694-2703: `bindDeliveryTable()`
- L2708-2708: `openSheet()`
- L2709-2709: `closeSheet()`
- L2714-2732: `openTextFieldSheet()`
- L2778-2796: `openRateHistory()`
- L2798-2835: `openRateEditor()`
- L2861-2861: `toast()`
- L2871-2878: `syncTelegramUI()`
- L2879-2879: `renderAll()`
- L2880-2880: `startApp()`
- L2890-2904: `renderGate()`
- L2906-3021: `bootGate()`


## deals.html (1983 строк)

### Секции

- L349-550: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L551-663: 2. Утилиты и состояние
- L664-921: 3. Экран списка
- L922-1134: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L1135-1859: 5. Карточка сделки
- L1860-1924: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1925-1983: 8. Загрузка и гейт

### Функции

- L385-385: `stagesOf()`
- L392-426: `migrateStages()`
- L433-441: `currentStage()`
- L442-442: `stageState()`
- L443-446: `isArchived()`
- L450-457: `lastMovementAt()`
- L458-461: `idleDays()`
- L477-481: `idleNorm()`
- L490-492: `moneyApplies()`
- L497-500: `moneyCalc()`
- L504-512: `moneyParts()`
- L518-525: `moneyDue()`
- L532-549: `fixMoneyAmounts()`
- L571-571: `onlyDigits()`
- L572-575: `formatDivisionCode()`
- L576-583: `formatSnils()`
- L584-600: `formatPhoneRu()`
- L603-607: `bindMask()`
- L611-617: `formatDateDdMmYyyy()`
- L620-623: `formatMoney()`
- L624-627: `tsToDdMmYyyy()`
- L631-638: `parseDdMmYyyy()`
- L639-639: `toast()`
- L640-640: `openSheet()`
- L641-641: `closeSheet()`
- L644-644: `initData()`
- L646-654: `api()`
- L656-662: `pluralDays()`
- L675-716: `bindDealSwipe()`
- L718-735: `openDeleteDealConfirm()`
- L739-777: `dealRowsHtml()`
- L778-792: `bindDealRows()`
- L794-794: `activeDealsOf()`
- L796-805: `renderList()`
- L809-809: `selectTab()`
- L819-839: `renderFlatDeals()`
- L841-849: `renderArchiveList()`
- L851-857: `pluralDealers()`
- L861-895: `renderDealerFolders()`
- L897-917: `renderDealerFolder()`
- L920-920: `auth_isRestricted()`
- L931-958: `openNewDealSheet()`
- L965-982: `askSamePerson()`
- L987-1118: `openPartySheet()`
- L1120-1133: `createDeal()`
- L1138-1145: `openDeal()`
- L1151-1211: `moneyCardHtml()`
- L1213-1392: `renderDeal()`
- L1396-1506: `openStageSheet()`
- L1508-1523: `openProblemSheet()`
- L1525-1603: `openDealEditSheet()`
- L1608-1629: `saveDeal()`
- L1637-1648: `loadCalcState()`
- L1666-1669: `endOfDayTs()`
- L1670-1670: `isSameLocalDay()`
- L1671-1671: `recalcKey()`
- L1676-1775: `recalcBookedCalc()`
- L1778-1792: `calcStatusHtml()`
- L1794-1840: `openCalcPicker()`
- L1843-1858: `calcFillsForDeal()`
- L1864-1923: `openParty()`
- L1928-1934: `reloadIndexes()`
- L1942-1945: `gate()`
- L1947-1977: `boot()`
