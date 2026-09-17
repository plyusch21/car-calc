# Эталон расчётов для сверки формулы (ТЗ 03, lib/calc.js)

Снято 17.09.2026 в Browser pane на локальном стенде (см. запись в РЕШЕНИЯ.md
за эту дату): Telegram и `/api/auth`/`/api/state` — заглушки, курсы
заморожены (снимок живого `/api/rates` + курс ЦБ на этот день), а
`/api/customs` — детерминированная заглушка, у которой пошлина и утильсбор
— функция от тела запроса. Поэтому **суммы таможни здесь не настоящие**:
их смысл — зафиксировать, что при тех же входах уходит тот же запрос к ТКС
и получается тот же итог. Тела запросов до/после переезда сравнены
построчно и совпали.

Общие входы: цена 1 000 000 в валюте маршрута, доп. расходы 50 000,
доставка в Москву по таблице (кузов «Седан / универсал / хэтчбек», 215 000 ₽),
брокер/агент/% банка — из `DEFAULT_CONFIG.routes`.

## Курсы (виджет / CONFIG.rates.value)

| Курс | raw | value (с корректировкой) |
|---|---|---|
| CNY (ЮАНЬ / ₽) | 12.837 | 12.837 |
| JPY (ЙЕНА / ₽) | 0.573 | 0.573 |
| KRW_USDT (USDT / ВОНА) | 1369 | 1364 (−5) |
| USDT_RUB (USDT / ₽) | 84.1732 | 87.1732 (+3) |

Виджет по маршрутам: Япония «0,5730 ЙЕНА / ₽», Корея «0,0639 ВОНА / ₽», Китай «12,8370 ЮАНЬ / ₽», ЕАЭС «87,1732 USDT / ₽».

## Восемь расчётов — до правок (коммит 585be11) и после (lib/calc.js)

| № | Маршрут | Особенность | Таможня («Расчёт TKS») | Инвойс в ₽ | Итого | После |
|---|---|---|---|---|---|---|
| 1 | Япония | бензин 1 500 см³, 100 л.с., 3–5 лет | 770 661 ₽ (Пошлина 743 909 + Утильсбор 26 752) | 610 675 ₽ | 1 726 336 ₽ | сошлось |
| 2 | Япония | электро 150 кВт, до 3 лет | 813 636 ₽ (Пошлина 763 901 + Утильсбор 49 735) | 610 675 ₽ | 1 769 311 ₽ | сошлось |
| 3 | Япония | дизель 3 000 см³, 200 л.с., старше 5 | 486 547 ₽ (Пошлина 482 288 + Утильсбор 4 259) | 610 675 ₽ | 1 442 222 ₽ | сошлось |
| 4 | Корея | бензин 2 000 см³, 150 л.с., до 3 лет, каталожная 1 200 000 ₩ | 950 367 ₽ (Пошлина 936 919 + Утильсбор 13 448 · по каталожной стоимости 1 200 000 ₩) | 67 105 ₽ | 1 367 472 ₽ | сошлось |
| 5 | Корея | электро 100 кВт, 3–5 лет | 358 970 ₽ (Пошлина 347 305 + Утильсбор 11 665) | 67 105 ₽ | 776 075 ₽ | сошлось |
| 6 | Китай | бензин 1 500 см³, 110 л.с., 3–5 лет | 258 571 ₽ (Пошлина 214 461 + Утильсбор 44 110) | 13 815 821 ₽ | 14 429 392 ₽ | сошлось |
| 7 | Китай | электро 200 л.с., до 3 лет | 862 413 ₽ (Пошлина 844 966 + Утильсбор 17 447) | 13 815 821 ₽ | 15 033 234 ₽ | сошлось |
| 8 | ЕАЭС | бензин 1 600 см³, 120 л.с., 3–5 лет, полная пошлина выкл. | 16 529 ₽ (Утильсбор 16 529) | 91 531 860 ₽ | 91 913 389 ₽ | сошлось |

Точные значения (`calcDeal` без округления), одинаковые до и после:

| № | invoiceRub | customsTotal | delivery | total |
|---|---|---|---|---|
| 1 | 610674.75 | 770661 | 215000 | 1726335.75 |
| 2 | 610674.75 | 813636 | 215000 | 1769310.75 |
| 3 | 610674.75 | 486547 | 215000 | 1442221.75 |
| 4 | 67105.46920821113 | 950367 | 215000 | 1367472.4692082112 |
| 5 | 67105.46920821113 | 358970 | 215000 | 776075.4692082112 |
| 6 | 13815821.25 | 258571 | 215000 | 14429392.25 |
| 7 | 13815821.25 | 862413 | 215000 | 15033234.25 |
| 8 | 91531860 | 16529 | 215000 | 91913389 |

## Тела запросов к ТКС, ушедшие со стенда (без initData; до и после — идентичны)

```
#1 {"ageCode":"age3","carValue":1050000,"carCurrency":"JPY","volumeCm3":1500,"dtype":"ben","power":100,"powerUnit":"ls","powerElectric":0,"powerElectricUnit":"ls"}
#2 {"ageCode":"age0","carValue":1050000,"carCurrency":"JPY","volumeCm3":0,"dtype":"electric","power":150,"powerUnit":"kvt","powerElectric":150,"powerElectricUnit":"kvt"}
#3 {"ageCode":"age5","carValue":1050000,"carCurrency":"JPY","volumeCm3":3000,"dtype":"dis","power":200,"powerUnit":"ls","powerElectric":0,"powerElectricUnit":"ls"}
#4 {"ageCode":"age0","carValue":1200000,"carCurrency":"KRW","volumeCm3":2000,"dtype":"ben","power":150,"powerUnit":"ls","powerElectric":0,"powerElectricUnit":"ls"}
#5 {"ageCode":"age3","carValue":1050000,"carCurrency":"KRW","volumeCm3":0,"dtype":"electric","power":100,"powerUnit":"kvt","powerElectric":100,"powerElectricUnit":"kvt"}
#6 {"ageCode":"age3","carValue":1050000,"carCurrency":"CNY","volumeCm3":1500,"dtype":"ben","power":110,"powerUnit":"ls","powerElectric":0,"powerElectricUnit":"ls"}
#7 {"ageCode":"age0","carValue":1050000,"carCurrency":"CNY","volumeCm3":0,"dtype":"electric","power":200,"powerUnit":"ls","powerElectric":200,"powerElectricUnit":"ls"}
#8 {"ageCode":"age3","carValue":1050000,"carCurrency":"USD","volumeCm3":1600,"dtype":"ben","power":120,"powerUnit":"ls","powerElectric":0,"powerElectricUnit":"ls"}
```

Про КП-картинку: PNG из html2canvas не побайтно-стабилен (хэши отличаются
даже у двух прогонов одного и того же кода), поэтому сверялись не хэши, а
HTML карточки: `buildKpHtml` не менялся, а его входы (`calcDeal`) совпали
до последнего знака; карточка отрисована и просмотрена на стенде.

## Эталон `node tools/calc-check.js`

Первый прогон, 17.09.2026. Скрипт подставляет курсы и таможню из таблиц
выше и печатает восемь итогов и восемь тел запроса; итоги обязаны совпадать
с точными значениями выше, тела — с блоком выше.

```
== Итоги calcDeal ==
#1 japan invoiceRub=610674.75 customs=770661 broker=80000 agent=50000 delivery=215000 total=1726335.75 label=Таможенные платежи
#2 japan invoiceRub=610674.75 customs=813636 broker=80000 agent=50000 delivery=215000 total=1769310.75 label=Таможенные платежи
#3 japan invoiceRub=610674.75 customs=486547 broker=80000 agent=50000 delivery=215000 total=1442221.75 label=Таможенные платежи
#4 korea invoiceRub=67105.46920821113 customs=950367 broker=85000 agent=50000 delivery=215000 total=1367472.4692082112 label=Таможенные платежи
#5 korea invoiceRub=67105.46920821113 customs=358970 broker=85000 agent=50000 delivery=215000 total=776075.4692082112 label=Таможенные платежи
#6 china invoiceRub=13815821.25 customs=258571 broker=90000 agent=50000 delivery=215000 total=14429392.25 label=Таможенные платежи
#7 china invoiceRub=13815821.25 customs=862413 broker=90000 agent=50000 delivery=215000 total=15033234.25 label=Таможенные платежи
#8 eaeu  invoiceRub=91531860 customs=16529 broker=100000 agent=50000 delivery=215000 total=91913389 label=Утилизационный сбор
== Тела запроса к ТКС (customsPayload) ==
#1 {"ageCode":"age3","carValue":1050000,"carCurrency":"JPY","volumeCm3":1500,"dtype":"ben","power":100,"powerUnit":"ls","powerElectric":0,"powerElectricUnit":"ls"}
#2 {"ageCode":"age0","carValue":1050000,"carCurrency":"JPY","volumeCm3":0,"dtype":"electric","power":150,"powerUnit":"kvt","powerElectric":150,"powerElectricUnit":"kvt"}
#3 {"ageCode":"age5","carValue":1050000,"carCurrency":"JPY","volumeCm3":3000,"dtype":"dis","power":200,"powerUnit":"ls","powerElectric":0,"powerElectricUnit":"ls"}
#4 {"ageCode":"age0","carValue":1200000,"carCurrency":"KRW","volumeCm3":2000,"dtype":"ben","power":150,"powerUnit":"ls","powerElectric":0,"powerElectricUnit":"ls"}
#5 {"ageCode":"age3","carValue":1050000,"carCurrency":"KRW","volumeCm3":0,"dtype":"electric","power":100,"powerUnit":"kvt","powerElectric":100,"powerElectricUnit":"kvt"}
#6 {"ageCode":"age3","carValue":1050000,"carCurrency":"CNY","volumeCm3":1500,"dtype":"ben","power":110,"powerUnit":"ls","powerElectric":0,"powerElectricUnit":"ls"}
#7 {"ageCode":"age0","carValue":1050000,"carCurrency":"CNY","volumeCm3":0,"dtype":"electric","power":200,"powerUnit":"ls","powerElectric":200,"powerElectricUnit":"ls"}
#8 {"ageCode":"age3","carValue":1050000,"carCurrency":"USD","volumeCm3":1600,"dtype":"ben","power":120,"powerUnit":"ls","powerElectric":0,"powerElectricUnit":"ls"}
== customsAutoTotal: ЕАЭС без полной пошлины берёт только утильсбор ==
eaeu, полная пошлина выкл: 16529
eaeu, полная пошлина вкл:  516529
japan:                     770661
```

