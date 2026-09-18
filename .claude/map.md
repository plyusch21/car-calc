# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (3223 строк)

### Секции

- L667-774: 1. Default configuration
- L775-803: 2. State
- L804-876: 3. Helpers
- L877-1002: 4. Currency rates — fetch via server-side proxy, manual always wins
- L1003-1007: 5. Delivery lookup
- L1008-1012: 6. Route → RUB conversion chains
- L1013-1023: 7. Main calculation
- L1024-2405: 8. Rendering
- L2406-2822: 9. Settings
- L2823-2962: 10. Rate editor sheet
- L2963-3007: 11. Nav + boot
- L3008-3223: 12. Доступ — два способа подтвердить, кто это (ТЗ 15):

### Функции

- L630-641: `saveDeliveryPrefs()`
- L642-665: `loadDeliveryPrefsFromCloud()`
- L676-676: `applyStoredConfig()`
- L689-689: `getInitData()`
- L690-690: `getTg()`
- L693-693: `inTelegram()`
- L696-699: `registerSW()`
- L703-703: `getSession()`
- L704-704: `setSession()`
- L708-708: `authFields()`
- L712-720: `tgHaptic()`
- L726-729: `formHasData()`
- L730-735: `updateClosingGuard()`
- L744-757: `saveConfig()`
- L758-763: `saveHistory()`
- L768-773: `saveArchive()`
- L780-795: `defaultForm()`
- L811-811: `groupInt()`
- L812-816: `fmt()`
- L817-817: `num()`
- L824-829: `invalidateCustomsAuto()`
- L835-843: `computeAgeFromDate()`
- L848-851: `applyAgeFromDate()`
- L855-861: `formatNumInput()`
- L862-862: `cleanNumInput()`
- L868-868: `escapeHtml()`
- L869-875: `openExternal()`
- L890-895: `logRateHistory()`
- L897-922: `applyAutoRate()`
- L924-956: `fetchAutoRates()`
- L965-983: `fetchCustomsQuote()`
- L985-993: `setRawValue()`
- L995-1001: `clearManualOverride()`
- L1006-1006: `deliveryPrice()`
- L1011-1011: `convertToRub()`
- L1021-1021: `lockedRates()`
- L1022-1022: `calcDeal()`
- L1066-1075: `rateWidgetData()`
- L1076-1080: `isUpdatedToday()`
- L1085-1089: `rateWidgetStatus()`
- L1090-1105: `rateWidgetHtml()`
- L1109-1117: `bindRateWidget()`
- L1122-1131: `refreshRatesUI()`
- L1136-1145: `fetchCbrReference()`
- L1147-1153: `cbrReferenceHtml()`
- L1155-1187: `openRatesSheet()`
- L1192-1206: `ratesPreviewCardHtml()`
- L1208-1226: `renderTabs()`
- L1230-1244: `renderTopbar()`
- L1246-1252: `renderContent()`
- L1254-1254: `field()`
- L1255-1255: `removeFromArr()`
- L1260-1262: `carriedHint()`
- L1266-1270: `unfilledHint()`
- L1271-1271: `unfilledClass()`
- L1275-1281: `clearFieldHints()`
- L1283-1285: `cityOptions()`
- L1290-1329: `resizeImageToBase64()`
- L1347-1403: `runListingParse()`
- L1405-1701: `renderCalc()`
- L1703-1720: `carDetailLines()`
- L1725-1729: `pushArchive()`
- L1730-1866: `showResult()`
- L1870-1872: `fmtRate()`
- L1881-2001: `buildKpHtml()`
- L2006-2040: `renderKpImageBlob()`
- L2057-2206: `shareResult()`
- L2217-2259: `bindHistorySwipe()`
- L2261-2277: `openClearHistoryConfirm()`
- L2279-2301: `openOtherRoutePicker()`
- L2308-2331: `renderArchiveList()`
- L2333-2404: `renderHistory()`
- L2426-2497: `renderSettingsView()`
- L2503-2515: `themeSettingsCard()`
- L2517-2525: `accountSettingsCard()`
- L2526-2528: `saveThemeChoice()`
- L2529-2544: `bindThemeSettings()`
- L2550-2566: `openResetConfirm()`
- L2568-2571: `fetchAdminUsers()`
- L2572-2575: `adminAction()`
- L2582-2612: `renderAdminUsersList()`
- L2613-2634: `loadAdminCard()`
- L2646-2654: `fetchDealsApi()`
- L2655-2675: `loadDealsExtraCard()`
- L2676-2692: `openDealsArchiveSheet()`
- L2693-2693: `csvCellIdx()`
- L2694-2694: `idleDaysIdx()`
- L2695-2704: `dealsCsvIdx()`
- L2705-2715: `partiesCsvIdx()`
- L2716-2759: `runDealsExport()`
- L2760-2778: `openWipeDealersConfirm()`
- L2780-2790: `routeSettingsBlock()`
- L2791-2800: `bindRouteSettings()`
- L2802-2811: `deliveryTable()`
- L2812-2821: `bindDeliveryTable()`
- L2826-2834: `openSheet()`
- L2835-2835: `closeSheet()`
- L2840-2858: `openTextFieldSheet()`
- L2904-2922: `openRateHistory()`
- L2924-2961: `openRateEditor()`
- L2987-2987: `toast()`
- L2997-3004: `syncTelegramUI()`
- L3005-3005: `renderAll()`
- L3006-3006: `startApp()`
- L3021-3026: `logout()`
- L3027-3040: `startLogin()`
- L3041-3068: `renderGate()`
- L3073-3087: `finishLoginFromUrl()`
- L3089-3217: `bootGate()`


## deals.html (2045 строк)

### Секции

- L387-588: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L589-713: 2. Утилиты и состояние
- L714-971: 3. Экран списка
- L972-1184: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L1185-1909: 5. Карточка сделки
- L1910-1974: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1975-2045: 8. Загрузка и гейт

### Функции

- L423-423: `stagesOf()`
- L430-464: `migrateStages()`
- L471-479: `currentStage()`
- L480-480: `stageState()`
- L481-484: `isArchived()`
- L488-495: `lastMovementAt()`
- L496-499: `idleDays()`
- L515-519: `idleNorm()`
- L528-530: `moneyApplies()`
- L535-538: `moneyCalc()`
- L542-550: `moneyParts()`
- L556-563: `moneyDue()`
- L570-587: `fixMoneyAmounts()`
- L609-609: `onlyDigits()`
- L610-613: `formatDivisionCode()`
- L614-621: `formatSnils()`
- L622-638: `formatPhoneRu()`
- L641-645: `bindMask()`
- L649-655: `formatDateDdMmYyyy()`
- L658-661: `formatMoney()`
- L662-665: `tsToDdMmYyyy()`
- L669-676: `parseDdMmYyyy()`
- L677-677: `toast()`
- L678-678: `openSheet()`
- L679-679: `closeSheet()`
- L682-682: `getInitData()`
- L683-683: `inTelegram()`
- L686-689: `registerSW()`
- L692-692: `getSession()`
- L694-694: `authFields()`
- L696-704: `api()`
- L706-712: `pluralDays()`
- L725-766: `bindDealSwipe()`
- L768-785: `openDeleteDealConfirm()`
- L789-827: `dealRowsHtml()`
- L828-842: `bindDealRows()`
- L844-844: `activeDealsOf()`
- L846-855: `renderList()`
- L859-859: `selectTab()`
- L869-889: `renderFlatDeals()`
- L891-899: `renderArchiveList()`
- L901-907: `pluralDealers()`
- L911-945: `renderDealerFolders()`
- L947-967: `renderDealerFolder()`
- L970-970: `auth_isRestricted()`
- L981-1008: `openNewDealSheet()`
- L1015-1032: `askSamePerson()`
- L1037-1168: `openPartySheet()`
- L1170-1183: `createDeal()`
- L1188-1195: `openDeal()`
- L1201-1261: `moneyCardHtml()`
- L1263-1442: `renderDeal()`
- L1446-1556: `openStageSheet()`
- L1558-1573: `openProblemSheet()`
- L1575-1653: `openDealEditSheet()`
- L1658-1679: `saveDeal()`
- L1687-1698: `loadCalcState()`
- L1716-1719: `endOfDayTs()`
- L1720-1720: `isSameLocalDay()`
- L1721-1721: `recalcKey()`
- L1726-1825: `recalcBookedCalc()`
- L1828-1842: `calcStatusHtml()`
- L1844-1890: `openCalcPicker()`
- L1893-1908: `calcFillsForDeal()`
- L1914-1973: `openParty()`
- L1978-1984: `reloadIndexes()`
- L1992-1995: `gate()`
- L1999-2001: `gateLogin()`
- L2003-2039: `boot()`
