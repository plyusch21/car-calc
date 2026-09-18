# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (3207 строк)

### Секции

- L658-759: 1. Default configuration
- L760-788: 2. State
- L789-861: 3. Helpers
- L862-987: 4. Currency rates — fetch via server-side proxy, manual always wins
- L988-992: 5. Delivery lookup
- L993-997: 6. Route → RUB conversion chains
- L998-1008: 7. Main calculation
- L1009-2390: 8. Rendering
- L2391-2807: 9. Settings
- L2808-2947: 10. Rate editor sheet
- L2948-2992: 11. Nav + boot
- L2993-3207: 12. Доступ — два способа подтвердить, кто это (ТЗ 15):

### Функции

- L621-632: `saveDeliveryPrefs()`
- L633-656: `loadDeliveryPrefsFromCloud()`
- L667-667: `applyStoredConfig()`
- L680-680: `getInitData()`
- L681-681: `getTg()`
- L684-684: `inTelegram()`
- L688-688: `getSession()`
- L689-689: `setSession()`
- L693-693: `authFields()`
- L697-705: `tgHaptic()`
- L711-714: `formHasData()`
- L715-720: `updateClosingGuard()`
- L729-742: `saveConfig()`
- L743-748: `saveHistory()`
- L753-758: `saveArchive()`
- L765-780: `defaultForm()`
- L796-796: `groupInt()`
- L797-801: `fmt()`
- L802-802: `num()`
- L809-814: `invalidateCustomsAuto()`
- L820-828: `computeAgeFromDate()`
- L833-836: `applyAgeFromDate()`
- L840-846: `formatNumInput()`
- L847-847: `cleanNumInput()`
- L853-853: `escapeHtml()`
- L854-860: `openExternal()`
- L875-880: `logRateHistory()`
- L882-907: `applyAutoRate()`
- L909-941: `fetchAutoRates()`
- L950-968: `fetchCustomsQuote()`
- L970-978: `setRawValue()`
- L980-986: `clearManualOverride()`
- L991-991: `deliveryPrice()`
- L996-996: `convertToRub()`
- L1006-1006: `lockedRates()`
- L1007-1007: `calcDeal()`
- L1051-1060: `rateWidgetData()`
- L1061-1065: `isUpdatedToday()`
- L1070-1074: `rateWidgetStatus()`
- L1075-1090: `rateWidgetHtml()`
- L1094-1102: `bindRateWidget()`
- L1107-1116: `refreshRatesUI()`
- L1121-1130: `fetchCbrReference()`
- L1132-1138: `cbrReferenceHtml()`
- L1140-1172: `openRatesSheet()`
- L1177-1191: `ratesPreviewCardHtml()`
- L1193-1211: `renderTabs()`
- L1215-1229: `renderTopbar()`
- L1231-1237: `renderContent()`
- L1239-1239: `field()`
- L1240-1240: `removeFromArr()`
- L1245-1247: `carriedHint()`
- L1251-1255: `unfilledHint()`
- L1256-1256: `unfilledClass()`
- L1260-1266: `clearFieldHints()`
- L1268-1270: `cityOptions()`
- L1275-1314: `resizeImageToBase64()`
- L1332-1388: `runListingParse()`
- L1390-1686: `renderCalc()`
- L1688-1705: `carDetailLines()`
- L1710-1714: `pushArchive()`
- L1715-1851: `showResult()`
- L1855-1857: `fmtRate()`
- L1866-1986: `buildKpHtml()`
- L1991-2025: `renderKpImageBlob()`
- L2042-2191: `shareResult()`
- L2202-2244: `bindHistorySwipe()`
- L2246-2262: `openClearHistoryConfirm()`
- L2264-2286: `openOtherRoutePicker()`
- L2293-2316: `renderArchiveList()`
- L2318-2389: `renderHistory()`
- L2411-2482: `renderSettingsView()`
- L2488-2500: `themeSettingsCard()`
- L2502-2510: `accountSettingsCard()`
- L2511-2513: `saveThemeChoice()`
- L2514-2529: `bindThemeSettings()`
- L2535-2551: `openResetConfirm()`
- L2553-2556: `fetchAdminUsers()`
- L2557-2560: `adminAction()`
- L2567-2597: `renderAdminUsersList()`
- L2598-2619: `loadAdminCard()`
- L2631-2639: `fetchDealsApi()`
- L2640-2660: `loadDealsExtraCard()`
- L2661-2677: `openDealsArchiveSheet()`
- L2678-2678: `csvCellIdx()`
- L2679-2679: `idleDaysIdx()`
- L2680-2689: `dealsCsvIdx()`
- L2690-2700: `partiesCsvIdx()`
- L2701-2744: `runDealsExport()`
- L2745-2763: `openWipeDealersConfirm()`
- L2765-2775: `routeSettingsBlock()`
- L2776-2785: `bindRouteSettings()`
- L2787-2796: `deliveryTable()`
- L2797-2806: `bindDeliveryTable()`
- L2811-2819: `openSheet()`
- L2820-2820: `closeSheet()`
- L2825-2843: `openTextFieldSheet()`
- L2889-2907: `openRateHistory()`
- L2909-2946: `openRateEditor()`
- L2972-2972: `toast()`
- L2982-2989: `syncTelegramUI()`
- L2990-2990: `renderAll()`
- L2991-2991: `startApp()`
- L3006-3011: `logout()`
- L3012-3025: `startLogin()`
- L3026-3053: `renderGate()`
- L3058-3072: `finishLoginFromUrl()`
- L3074-3201: `bootGate()`


## deals.html (2029 строк)

### Секции

- L378-579: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L580-698: 2. Утилиты и состояние
- L699-956: 3. Экран списка
- L957-1169: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L1170-1894: 5. Карточка сделки
- L1895-1959: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1960-2029: 8. Загрузка и гейт

### Функции

- L414-414: `stagesOf()`
- L421-455: `migrateStages()`
- L462-470: `currentStage()`
- L471-471: `stageState()`
- L472-475: `isArchived()`
- L479-486: `lastMovementAt()`
- L487-490: `idleDays()`
- L506-510: `idleNorm()`
- L519-521: `moneyApplies()`
- L526-529: `moneyCalc()`
- L533-541: `moneyParts()`
- L547-554: `moneyDue()`
- L561-578: `fixMoneyAmounts()`
- L600-600: `onlyDigits()`
- L601-604: `formatDivisionCode()`
- L605-612: `formatSnils()`
- L613-629: `formatPhoneRu()`
- L632-636: `bindMask()`
- L640-646: `formatDateDdMmYyyy()`
- L649-652: `formatMoney()`
- L653-656: `tsToDdMmYyyy()`
- L660-667: `parseDdMmYyyy()`
- L668-668: `toast()`
- L669-669: `openSheet()`
- L670-670: `closeSheet()`
- L673-673: `getInitData()`
- L674-674: `inTelegram()`
- L677-677: `getSession()`
- L679-679: `authFields()`
- L681-689: `api()`
- L691-697: `pluralDays()`
- L710-751: `bindDealSwipe()`
- L753-770: `openDeleteDealConfirm()`
- L774-812: `dealRowsHtml()`
- L813-827: `bindDealRows()`
- L829-829: `activeDealsOf()`
- L831-840: `renderList()`
- L844-844: `selectTab()`
- L854-874: `renderFlatDeals()`
- L876-884: `renderArchiveList()`
- L886-892: `pluralDealers()`
- L896-930: `renderDealerFolders()`
- L932-952: `renderDealerFolder()`
- L955-955: `auth_isRestricted()`
- L966-993: `openNewDealSheet()`
- L1000-1017: `askSamePerson()`
- L1022-1153: `openPartySheet()`
- L1155-1168: `createDeal()`
- L1173-1180: `openDeal()`
- L1186-1246: `moneyCardHtml()`
- L1248-1427: `renderDeal()`
- L1431-1541: `openStageSheet()`
- L1543-1558: `openProblemSheet()`
- L1560-1638: `openDealEditSheet()`
- L1643-1664: `saveDeal()`
- L1672-1683: `loadCalcState()`
- L1701-1704: `endOfDayTs()`
- L1705-1705: `isSameLocalDay()`
- L1706-1706: `recalcKey()`
- L1711-1810: `recalcBookedCalc()`
- L1813-1827: `calcStatusHtml()`
- L1829-1875: `openCalcPicker()`
- L1878-1893: `calcFillsForDeal()`
- L1899-1958: `openParty()`
- L1963-1969: `reloadIndexes()`
- L1977-1980: `gate()`
- L1984-1986: `gateLogin()`
- L1988-2023: `boot()`
