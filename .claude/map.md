# Карта index.html и deals.html

Сгенерировано `tools/mapgen.sh` — не редактировать руками. После любой правки, сдвигающей нумерацию строк в этих файлах, перегенерировать: `bash tools/mapgen.sh`.

Использование: найти нужный диапазон здесь, прочитать его `sed -n 'START,ENDp' файл`, а не файл целиком.


## index.html (2844 строк)

### Секции

- L468-557: 1. Default configuration
- L558-586: 2. State
- L587-656: 3. Helpers
- L657-782: 4. Currency rates — fetch via server-side proxy, manual always wins
- L783-787: 5. Delivery lookup
- L788-792: 6. Route → RUB conversion chains
- L793-803: 7. Main calculation
- L804-2173: 8. Rendering
- L2174-2521: 9. Settings
- L2522-2653: 10. Rate editor sheet
- L2654-2698: 11. Nav + boot
- L2699-2844: 12. Доступ через Telegram — приложение работает только как Mini App.

### Функции

- L435-443: `saveDeliveryPrefs()`
- L444-466: `loadDeliveryPrefsFromCloud()`
- L477-477: `applyStoredConfig()`
- L490-490: `getInitData()`
- L491-491: `getTg()`
- L495-503: `tgHaptic()`
- L509-512: `formHasData()`
- L513-518: `updateClosingGuard()`
- L527-540: `saveConfig()`
- L541-546: `saveHistory()`
- L551-556: `saveArchive()`
- L563-578: `defaultForm()`
- L594-594: `groupInt()`
- L595-599: `fmt()`
- L600-600: `num()`
- L607-612: `invalidateCustomsAuto()`
- L618-626: `computeAgeFromDate()`
- L631-634: `applyAgeFromDate()`
- L638-644: `formatNumInput()`
- L645-645: `cleanNumInput()`
- L651-651: `escapeHtml()`
- L652-655: `openExternal()`
- L670-675: `logRateHistory()`
- L677-702: `applyAutoRate()`
- L704-736: `fetchAutoRates()`
- L745-763: `fetchCustomsQuote()`
- L765-773: `setRawValue()`
- L775-781: `clearManualOverride()`
- L786-786: `deliveryPrice()`
- L791-791: `convertToRub()`
- L801-801: `lockedRates()`
- L802-802: `calcDeal()`
- L844-853: `rateWidgetData()`
- L854-858: `isUpdatedToday()`
- L863-867: `rateWidgetStatus()`
- L868-883: `rateWidgetHtml()`
- L887-895: `bindRateWidget()`
- L900-909: `refreshRatesUI()`
- L914-923: `fetchCbrReference()`
- L925-931: `cbrReferenceHtml()`
- L933-965: `openRatesSheet()`
- L970-984: `ratesPreviewCardHtml()`
- L986-1004: `renderTabs()`
- L1008-1022: `renderTopbar()`
- L1024-1030: `renderContent()`
- L1032-1032: `field()`
- L1033-1033: `removeFromArr()`
- L1038-1040: `carriedHint()`
- L1044-1048: `unfilledHint()`
- L1049-1049: `unfilledClass()`
- L1053-1059: `clearFieldHints()`
- L1061-1063: `cityOptions()`
- L1068-1107: `resizeImageToBase64()`
- L1125-1181: `runListingParse()`
- L1183-1478: `renderCalc()`
- L1480-1496: `carDetailLines()`
- L1501-1505: `pushArchive()`
- L1506-1642: `showResult()`
- L1646-1648: `fmtRate()`
- L1657-1775: `buildKpHtml()`
- L1780-1811: `renderKpImageBlob()`
- L1828-1974: `shareResult()`
- L1985-2027: `bindHistorySwipe()`
- L2029-2045: `openClearHistoryConfirm()`
- L2047-2069: `openOtherRoutePicker()`
- L2076-2099: `renderArchiveList()`
- L2101-2172: `renderHistory()`
- L2190-2251: `renderSettingsView()`
- L2253-2269: `openResetConfirm()`
- L2271-2274: `fetchAdminUsers()`
- L2275-2278: `adminAction()`
- L2285-2312: `renderAdminUsersList()`
- L2313-2333: `loadAdminCard()`
- L2345-2353: `fetchDealsApi()`
- L2354-2374: `loadDealsExtraCard()`
- L2375-2391: `openDealsArchiveSheet()`
- L2392-2392: `csvCellIdx()`
- L2393-2393: `idleDaysIdx()`
- L2394-2403: `dealsCsvIdx()`
- L2404-2414: `partiesCsvIdx()`
- L2415-2458: `runDealsExport()`
- L2459-2477: `openWipeDealersConfirm()`
- L2479-2489: `routeSettingsBlock()`
- L2490-2499: `bindRouteSettings()`
- L2501-2510: `deliveryTable()`
- L2511-2520: `bindDeliveryTable()`
- L2525-2525: `openSheet()`
- L2526-2526: `closeSheet()`
- L2531-2549: `openTextFieldSheet()`
- L2595-2613: `openRateHistory()`
- L2615-2652: `openRateEditor()`
- L2678-2678: `toast()`
- L2688-2695: `syncTelegramUI()`
- L2696-2696: `renderAll()`
- L2697-2697: `startApp()`
- L2707-2721: `renderGate()`
- L2723-2838: `bootGate()`


## deals.html (1867 строк)

### Секции

- L234-435: 1. Этапы — перечень живёт здесь, в коде, и только здесь.
- L436-548: 2. Утилиты и состояние
- L549-806: 3. Экран списка
- L807-1019: 4. Создание сделки: физик ищется по телефону, дилер — отдельным шагом
- L1020-1744: 5. Карточка сделки
- L1745-1809: 6. Профиль контакта (физик или дилер) — физики доступны через вкладку
- L1810-1867: 8. Загрузка и гейт

### Функции

- L270-270: `stagesOf()`
- L277-311: `migrateStages()`
- L318-326: `currentStage()`
- L327-327: `stageState()`
- L328-331: `isArchived()`
- L335-342: `lastMovementAt()`
- L343-346: `idleDays()`
- L362-366: `idleNorm()`
- L375-377: `moneyApplies()`
- L382-385: `moneyCalc()`
- L389-397: `moneyParts()`
- L403-410: `moneyDue()`
- L417-434: `fixMoneyAmounts()`
- L456-456: `onlyDigits()`
- L457-460: `formatDivisionCode()`
- L461-468: `formatSnils()`
- L469-485: `formatPhoneRu()`
- L488-492: `bindMask()`
- L496-502: `formatDateDdMmYyyy()`
- L505-508: `formatMoney()`
- L509-512: `tsToDdMmYyyy()`
- L516-523: `parseDdMmYyyy()`
- L524-524: `toast()`
- L525-525: `openSheet()`
- L526-526: `closeSheet()`
- L529-529: `initData()`
- L531-539: `api()`
- L541-547: `pluralDays()`
- L560-601: `bindDealSwipe()`
- L603-620: `openDeleteDealConfirm()`
- L624-662: `dealRowsHtml()`
- L663-677: `bindDealRows()`
- L679-679: `activeDealsOf()`
- L681-690: `renderList()`
- L694-694: `selectTab()`
- L704-724: `renderFlatDeals()`
- L726-734: `renderArchiveList()`
- L736-742: `pluralDealers()`
- L746-780: `renderDealerFolders()`
- L782-802: `renderDealerFolder()`
- L805-805: `auth_isRestricted()`
- L816-843: `openNewDealSheet()`
- L850-867: `askSamePerson()`
- L872-1003: `openPartySheet()`
- L1005-1018: `createDeal()`
- L1023-1030: `openDeal()`
- L1036-1096: `moneyCardHtml()`
- L1098-1277: `renderDeal()`
- L1281-1391: `openStageSheet()`
- L1393-1408: `openProblemSheet()`
- L1410-1488: `openDealEditSheet()`
- L1493-1514: `saveDeal()`
- L1522-1533: `loadCalcState()`
- L1551-1554: `endOfDayTs()`
- L1555-1555: `isSameLocalDay()`
- L1556-1556: `recalcKey()`
- L1561-1660: `recalcBookedCalc()`
- L1663-1677: `calcStatusHtml()`
- L1679-1725: `openCalcPicker()`
- L1728-1743: `calcFillsForDeal()`
- L1749-1808: `openParty()`
- L1813-1819: `reloadIndexes()`
- L1827-1830: `gate()`
- L1832-1861: `boot()`
