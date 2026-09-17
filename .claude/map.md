# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (3022 строк)

### Секции

- L604-693: 1. Default configuration
- L694-722: 2. State
- L723-792: 3. Helpers
- L793-918: 4. Currency rates — fetch via server-side proxy, manual always wins
- L919-923: 5. Delivery lookup
- L924-928: 6. Route → RUB conversion chains
- L929-939: 7. Main calculation
- L940-2310: 8. Rendering
- L2311-2699: 9. Settings
- L2700-2831: 10. Rate editor sheet
- L2832-2876: 11. Nav + boot
- L2877-3022: 12. Доступ через Telegram — приложение работает только как Mini App.

### Функции

- L571-579: `saveDeliveryPrefs()`
- L580-602: `loadDeliveryPrefsFromCloud()`
- L613-613: `applyStoredConfig()`
- L626-626: `getInitData()`
- L627-627: `getTg()`
- L631-639: `tgHaptic()`
- L645-648: `formHasData()`
- L649-654: `updateClosingGuard()`
- L663-676: `saveConfig()`
- L677-682: `saveHistory()`
- L687-692: `saveArchive()`
- L699-714: `defaultForm()`
- L730-730: `groupInt()`
- L731-735: `fmt()`
- L736-736: `num()`
- L743-748: `invalidateCustomsAuto()`
- L754-762: `computeAgeFromDate()`
- L767-770: `applyAgeFromDate()`
- L774-780: `formatNumInput()`
- L781-781: `cleanNumInput()`
- L787-787: `escapeHtml()`
- L788-791: `openExternal()`
- L806-811: `logRateHistory()`
- L813-838: `applyAutoRate()`
- L840-872: `fetchAutoRates()`
- L881-899: `fetchCustomsQuote()`
- L901-909: `setRawValue()`
- L911-917: `clearManualOverride()`
- L922-922: `deliveryPrice()`
- L927-927: `convertToRub()`
- L937-937: `lockedRates()`
- L938-938: `calcDeal()`
- L980-989: `rateWidgetData()`
- L990-994: `isUpdatedToday()`
- L999-1003: `rateWidgetStatus()`
- L1004-1019: `rateWidgetHtml()`
- L1023-1031: `bindRateWidget()`
- L1036-1045: `refreshRatesUI()`
- L1050-1059: `fetchCbrReference()`
- L1061-1067: `cbrReferenceHtml()`
- L1069-1101: `openRatesSheet()`
- L1106-1120: `ratesPreviewCardHtml()`
- L1122-1140: `renderTabs()`
- L1144-1158: `renderTopbar()`
- L1160-1166: `renderContent()`
- L1168-1168: `field()`
- L1169-1169: `removeFromArr()`
- L1174-1176: `carriedHint()`
- L1180-1184: `unfilledHint()`
- L1185-1185: `unfilledClass()`
- L1189-1195: `clearFieldHints()`
- L1197-1199: `cityOptions()`
- L1204-1243: `resizeImageToBase64()`
- L1261-1317: `runListingParse()`
- L1319-1614: `renderCalc()`
- L1616-1633: `carDetailLines()`
- L1638-1642: `pushArchive()`
- L1643-1779: `showResult()`
- L1783-1785: `fmtRate()`
- L1794-1912: `buildKpHtml()`
- L1917-1948: `renderKpImageBlob()`
- L1965-2111: `shareResult()`
- L2122-2164: `bindHistorySwipe()`
- L2166-2182: `openClearHistoryConfirm()`
- L2184-2206: `openOtherRoutePicker()`
- L2213-2236: `renderArchiveList()`
- L2238-2309: `renderHistory()`
- L2329-2393: `renderSettingsView()`
- L2399-2411: `themeSettingsCard()`
- L2412-2425: `bindThemeSettings()`
- L2431-2447: `openResetConfirm()`
- L2449-2452: `fetchAdminUsers()`
- L2453-2456: `adminAction()`
- L2463-2490: `renderAdminUsersList()`
- L2491-2511: `loadAdminCard()`
- L2523-2531: `fetchDealsApi()`
- L2532-2552: `loadDealsExtraCard()`
- L2553-2569: `openDealsArchiveSheet()`
- L2570-2570: `csvCellIdx()`
- L2571-2571: `idleDaysIdx()`
- L2572-2581: `dealsCsvIdx()`
- L2582-2592: `partiesCsvIdx()`
- L2593-2636: `runDealsExport()`
- L2637-2655: `openWipeDealersConfirm()`
- L2657-2667: `routeSettingsBlock()`
- L2668-2677: `bindRouteSettings()`
- L2679-2688: `deliveryTable()`
- L2689-2698: `bindDeliveryTable()`
- L2703-2703: `openSheet()`
- L2704-2704: `closeSheet()`
- L2709-2727: `openTextFieldSheet()`
- L2773-2791: `openRateHistory()`
- L2793-2830: `openRateEditor()`
- L2856-2856: `toast()`
- L2866-2873: `syncTelegramUI()`
- L2874-2874: `renderAll()`
- L2875-2875: `startApp()`
- L2885-2899: `renderGate()`
- L2901-3016: `bootGate()`


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
