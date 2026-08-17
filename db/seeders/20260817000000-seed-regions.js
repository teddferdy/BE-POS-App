'use strict'

const PROVINCES = [
  {
    "code": "11",
    "name": "Aceh",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": 5.571,
    "longitude": 95.341
  },
  {
    "code": "12",
    "name": "Sumatera Utara",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": 3.581,
    "longitude": 98.672
  },
  {
    "code": "13",
    "name": "Sumatera Barat",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -0.938,
    "longitude": 100.36
  },
  {
    "code": "14",
    "name": "Riau",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": 0.518,
    "longitude": 101.446
  },
  {
    "code": "15",
    "name": "Jambi",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -1.604,
    "longitude": 103.584
  },
  {
    "code": "16",
    "name": "Sumatera Selatan",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -2.977,
    "longitude": 104.751
  },
  {
    "code": "17",
    "name": "Bengkulu",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -3.821,
    "longitude": 102.284
  },
  {
    "code": "18",
    "name": "Lampung",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -5.441,
    "longitude": 105.258
  },
  {
    "code": "19",
    "name": "Kepulauan Bangka Belitung",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -2.153,
    "longitude": 106.158
  },
  {
    "code": "21",
    "name": "Kepulauan Riau",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": 0.876,
    "longitude": 104.445
  },
  {
    "code": "31",
    "name": "Daerah Khusus Ibukota Jakarta",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -6.178,
    "longitude": 106.828
  },
  {
    "code": "32",
    "name": "Jawa Barat",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -6.902,
    "longitude": 107.619
  },
  {
    "code": "33",
    "name": "Jawa Tengah",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -6.993,
    "longitude": 110.42
  },
  {
    "code": "34",
    "name": "Daerah Istimewa Yogyakarta",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -7.795,
    "longitude": 110.367
  },
  {
    "code": "35",
    "name": "Jawa Timur",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -7.246,
    "longitude": 112.739
  },
  {
    "code": "36",
    "name": "Banten",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -6.174,
    "longitude": 106.157
  },
  {
    "code": "51",
    "name": "Bali",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -8.668,
    "longitude": 115.234
  },
  {
    "code": "52",
    "name": "Nusa Tenggara Barat",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -8.581,
    "longitude": 116.11
  },
  {
    "code": "53",
    "name": "Nusa Tenggara Timur",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -10.171,
    "longitude": 123.607
  },
  {
    "code": "61",
    "name": "Kalimantan Barat",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -0.061,
    "longitude": 109.353
  },
  {
    "code": "62",
    "name": "Kalimantan Tengah",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -2.217,
    "longitude": 113.919
  },
  {
    "code": "63",
    "name": "Kalimantan Selatan",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -3.484,
    "longitude": 114.834
  },
  {
    "code": "64",
    "name": "Kalimantan Timur",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -0.501,
    "longitude": 117.139
  },
  {
    "code": "65",
    "name": "Kalimantan Utara",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": 2.842,
    "longitude": 117.374
  },
  {
    "code": "71",
    "name": "Sulawesi Utara",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": 1.47,
    "longitude": 124.845
  },
  {
    "code": "72",
    "name": "Sulawesi Tengah",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -0.891,
    "longitude": 119.871
  },
  {
    "code": "73",
    "name": "Sulawesi Selatan",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -5.139,
    "longitude": 119.452
  },
  {
    "code": "74",
    "name": "Sulawesi Tenggara",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -4.025,
    "longitude": 122.54
  },
  {
    "code": "75",
    "name": "Gorontalo",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": 0.524,
    "longitude": 123.077
  },
  {
    "code": "76",
    "name": "Sulawesi Barat",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -2.665,
    "longitude": 118.853
  },
  {
    "code": "81",
    "name": "Maluku",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -3.694,
    "longitude": 128.183
  },
  {
    "code": "82",
    "name": "Maluku Utara",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": 0.756,
    "longitude": 127.61
  },
  {
    "code": "91",
    "name": "Papua",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -3.363,
    "longitude": 135.504
  },
  {
    "code": "92",
    "name": "Papua Barat",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": -2.536,
    "longitude": 140.715
  },
  {
    "code": "93",
    "name": "Papua Selatan",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "94",
    "name": "Papua Tengah",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "95",
    "name": "Papua Pegunungan",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "96",
    "name": "Papua Barat Daya",
    "level": "province",
    "parentCode": null,
    "postalCode": null,
    "latitude": null,
    "longitude": null
  }
]

const CITIES = [
  {
    "code": "1101",
    "name": "Kabupaten Aceh Selatan",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 4.933,
    "longitude": 97.784
  },
  {
    "code": "1102",
    "name": "Kabupaten Aceh Tenggara",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 4.622,
    "longitude": 96.846
  },
  {
    "code": "1103",
    "name": "Kabupaten Aceh Timur",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 4.153,
    "longitude": 96.131
  },
  {
    "code": "1104",
    "name": "Kabupaten Aceh Tengah",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 5.297,
    "longitude": 95.611
  },
  {
    "code": "1105",
    "name": "Kabupaten Aceh Barat",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 5.368,
    "longitude": 95.958
  },
  {
    "code": "1106",
    "name": "Kabupaten Aceh Besar",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 5.076,
    "longitude": 97.303
  },
  {
    "code": "1107",
    "name": "Kabupaten Pidie",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 2.461,
    "longitude": 96.38
  },
  {
    "code": "1108",
    "name": "Kabupaten Aceh Utara",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 5.208,
    "longitude": 96.726
  },
  {
    "code": "1109",
    "name": "Kabupaten Simeulue",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 3.255,
    "longitude": 97.174
  },
  {
    "code": "1110",
    "name": "Kabupaten Aceh Singkil",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 3.473,
    "longitude": 97.819
  },
  {
    "code": "1111",
    "name": "Kabupaten Bireuen",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 2.271,
    "longitude": 97.815
  },
  {
    "code": "1112",
    "name": "Kabupaten Aceh Barat Daya",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 3.739,
    "longitude": 96.852
  },
  {
    "code": "1113",
    "name": "Kabupaten Gayo Lues",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 3.993,
    "longitude": 97.325
  },
  {
    "code": "1114",
    "name": "Kabupaten Aceh Jaya",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 4.301,
    "longitude": 98.046
  },
  {
    "code": "1115",
    "name": "Kabupaten Nagan Raya",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 4.169,
    "longitude": 96.324
  },
  {
    "code": "1116",
    "name": "Kabupaten Aceh Tamiang",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 4.624,
    "longitude": 95.617
  },
  {
    "code": "1117",
    "name": "Kabupaten Bener Meriah",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 4.703,
    "longitude": 96.862
  },
  {
    "code": "1118",
    "name": "Kabupaten Pidie Jaya",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 5.229,
    "longitude": 96.245
  },
  {
    "code": "1171",
    "name": "Kota Banda Aceh",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 5.55,
    "longitude": 95.318
  },
  {
    "code": "1172",
    "name": "Kota Sabang",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 5.893,
    "longitude": 95.321
  },
  {
    "code": "1173",
    "name": "Kota Lhokseumawe",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 4.469,
    "longitude": 97.966
  },
  {
    "code": "1174",
    "name": "Kota Langsa",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 5.179,
    "longitude": 97.149
  },
  {
    "code": "1175",
    "name": "Kota Subulussalam",
    "level": "city",
    "parentCode": "11",
    "postalCode": null,
    "latitude": 2.671,
    "longitude": 97.993
  },
  {
    "code": "1201",
    "name": "Kabupaten Tapanuli Tengah",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 1.242,
    "longitude": 97.65
  },
  {
    "code": "1202",
    "name": "Kabupaten Tapanuli Utara",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 3.743,
    "longitude": 98.448
  },
  {
    "code": "1203",
    "name": "Kabupaten Tapanuli Selatan",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 1.52,
    "longitude": 99.303
  },
  {
    "code": "1204",
    "name": "Kabupaten Nias",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 1.685,
    "longitude": 98.828
  },
  {
    "code": "1205",
    "name": "Kabupaten Langkat",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 0.797,
    "longitude": 99.579
  },
  {
    "code": "1206",
    "name": "Kabupaten Karo",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 2.748,
    "longitude": 98.314
  },
  {
    "code": "1207",
    "name": "Kabupaten Deli Serdang",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 2.332,
    "longitude": 99.051
  },
  {
    "code": "1208",
    "name": "Kabupaten Simalungun",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 2.988,
    "longitude": 99.613
  },
  {
    "code": "1209",
    "name": "Kabupaten Asahan",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 2.965,
    "longitude": 98.862
  },
  {
    "code": "1210",
    "name": "Kabupaten Labuhanbatu",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 3.551,
    "longitude": 98.866
  },
  {
    "code": "1211",
    "name": "Kabupaten Dairi",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 2.07,
    "longitude": 99.857
  },
  {
    "code": "1212",
    "name": "Kabupaten Toba",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 3.111,
    "longitude": 98.501
  },
  {
    "code": "1213",
    "name": "Kabupaten Mandailing Natal",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 2.022,
    "longitude": 98.962
  },
  {
    "code": "1214",
    "name": "Kabupaten Nias Selatan",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 0.583,
    "longitude": 97.778
  },
  {
    "code": "1215",
    "name": "Kabupaten Pakpak Bharat",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 2.25,
    "longitude": 98.79
  },
  {
    "code": "1216",
    "name": "Kabupaten Humbang Hasundutan",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 2.541,
    "longitude": 98.323
  },
  {
    "code": "1217",
    "name": "Kabupaten Samosir",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 2.56,
    "longitude": 98.722
  },
  {
    "code": "1218",
    "name": "Kabupaten Serdang Bedagai",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 3.491,
    "longitude": 99.126
  },
  {
    "code": "1219",
    "name": "Kabupaten Batu Bara",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 3.172,
    "longitude": 99.421
  },
  {
    "code": "1220",
    "name": "Kabupaten Padang Lawas Utara",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 1.495,
    "longitude": 99.62
  },
  {
    "code": "1221",
    "name": "Kabupaten Padang Lawas",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 1.056,
    "longitude": 99.776
  },
  {
    "code": "1222",
    "name": "Kabupaten Labuhanbatu Selatan",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 1.868,
    "longitude": 100.041
  },
  {
    "code": "1223",
    "name": "Kabupaten Labuhanbatu Utara",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 2.563,
    "longitude": 99.658
  },
  {
    "code": "1224",
    "name": "Kabupaten Nias Utara",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 1.389,
    "longitude": 97.381
  },
  {
    "code": "1225",
    "name": "Kabupaten Nias Barat",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 0.999,
    "longitude": 97.495
  },
  {
    "code": "1271",
    "name": "Kota Medan",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 3.603,
    "longitude": 98.483
  },
  {
    "code": "1272",
    "name": "Kota Pematangsiantar",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 1.746,
    "longitude": 98.776
  },
  {
    "code": "1273",
    "name": "Kota Sibolga",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 3.59,
    "longitude": 98.675
  },
  {
    "code": "1274",
    "name": "Kota Tanjungbalai",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 2.956,
    "longitude": 99.062
  },
  {
    "code": "1275",
    "name": "Kota Binjai",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 3.328,
    "longitude": 99.166
  },
  {
    "code": "1276",
    "name": "Kota Tebing Tinggi",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 2.948,
    "longitude": 99.767
  },
  {
    "code": "1277",
    "name": "Kota Padangsidimpuan",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 1.378,
    "longitude": 99.271
  },
  {
    "code": "1278",
    "name": "Kota Gunungsitoli",
    "level": "city",
    "parentCode": "12",
    "postalCode": null,
    "latitude": 1.283,
    "longitude": 97.613
  },
  {
    "code": "1301",
    "name": "Kabupaten Pesisir Selatan",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.952,
    "longitude": 100.621
  },
  {
    "code": "1302",
    "name": "Kabupaten Solok",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.666,
    "longitude": 100.945
  },
  {
    "code": "1303",
    "name": "Kabupaten Sijunjung",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.474,
    "longitude": 100.623
  },
  {
    "code": "1304",
    "name": "Kabupaten Tanah Datar",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.621,
    "longitude": 100.307
  },
  {
    "code": "1305",
    "name": "Kabupaten Padang Pariaman",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.315,
    "longitude": 100.03
  },
  {
    "code": "1306",
    "name": "Kabupaten Agam",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.152,
    "longitude": 100.661
  },
  {
    "code": "1307",
    "name": "Kabupaten Lima Puluh Kota",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": 0.14,
    "longitude": 100.167
  },
  {
    "code": "1308",
    "name": "Kabupaten Pasaman",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -2.054,
    "longitude": 99.58
  },
  {
    "code": "1309",
    "name": "Kabupaten Kepulauan Mentawai",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -1.348,
    "longitude": 100.578
  },
  {
    "code": "1310",
    "name": "Kabupaten Dharmasraya",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -1.556,
    "longitude": 101.24
  },
  {
    "code": "1311",
    "name": "Kabupaten Solok Selatan",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.953,
    "longitude": 101.494
  },
  {
    "code": "1312",
    "name": "Kabupaten Pasaman Barat",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": 0.11,
    "longitude": 99.828
  },
  {
    "code": "1371",
    "name": "Kota Padang",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.876,
    "longitude": 100.387
  },
  {
    "code": "1372",
    "name": "Kota Solok",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.799,
    "longitude": 100.653
  },
  {
    "code": "1373",
    "name": "Kota Sawahlunto",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.675,
    "longitude": 100.768
  },
  {
    "code": "1374",
    "name": "Kota Padang Panjang",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.462,
    "longitude": 100.39
  },
  {
    "code": "1375",
    "name": "Kota Bukittinggi",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.285,
    "longitude": 100.368
  },
  {
    "code": "1376",
    "name": "Kota Payakumbuh",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.223,
    "longitude": 100.632
  },
  {
    "code": "1377",
    "name": "Kota Pariaman",
    "level": "city",
    "parentCode": "13",
    "postalCode": null,
    "latitude": -0.629,
    "longitude": 100.138
  },
  {
    "code": "1401",
    "name": "Kabupaten Kampar",
    "level": "city",
    "parentCode": "14",
    "postalCode": null,
    "latitude": 0.9,
    "longitude": 100.307
  },
  {
    "code": "1402",
    "name": "Kabupaten Indragiri Hulu",
    "level": "city",
    "parentCode": "14",
    "postalCode": null,
    "latitude": -0.393,
    "longitude": 102.438
  },
  {
    "code": "1403",
    "name": "Kabupaten Bengkalis",
    "level": "city",
    "parentCode": "14",
    "postalCode": null,
    "latitude": 0.805,
    "longitude": 102.02
  },
  {
    "code": "1404",
    "name": "Kabupaten Indragiri Hilir",
    "level": "city",
    "parentCode": "14",
    "postalCode": null,
    "latitude": 1.473,
    "longitude": 102.113
  },
  {
    "code": "1405",
    "name": "Kabupaten Pelalawan",
    "level": "city",
    "parentCode": "14",
    "postalCode": null,
    "latitude": -0.315,
    "longitude": 103.158
  },
  {
    "code": "1406",
    "name": "Kabupaten Rokan Hulu",
    "level": "city",
    "parentCode": "14",
    "postalCode": null,
    "latitude": 2.099,
    "longitude": 100.818
  },
  {
    "code": "1407",
    "name": "Kabupaten Rokan Hilir",
    "level": "city",
    "parentCode": "14",
    "postalCode": null,
    "latitude": -0.505,
    "longitude": 101.538
  },
  {
    "code": "1408",
    "name": "Kabupaten Siak",
    "level": "city",
    "parentCode": "14",
    "postalCode": null,
    "latitude": 0.384,
    "longitude": 101.842
  },
  {
    "code": "1409",
    "name": "Kabupaten Kuantan Singingi",
    "level": "city",
    "parentCode": "14",
    "postalCode": null,
    "latitude": 0.314,
    "longitude": 101.018
  },
  {
    "code": "1410",
    "name": "Kabupaten Kepulauan Meranti",
    "level": "city",
    "parentCode": "14",
    "postalCode": null,
    "latitude": 1.001,
    "longitude": 102.726
  },
  {
    "code": "1471",
    "name": "Kota Pekanbaru",
    "level": "city",
    "parentCode": "14",
    "postalCode": null,
    "latitude": 0.513,
    "longitude": 101.447
  },
  {
    "code": "1472",
    "name": "Kota Dumai",
    "level": "city",
    "parentCode": "14",
    "postalCode": null,
    "latitude": 1.667,
    "longitude": 101.4
  },
  {
    "code": "1501",
    "name": "Kabupaten Kerinci",
    "level": "city",
    "parentCode": "15",
    "postalCode": null,
    "latitude": -2.057,
    "longitude": 101.388
  },
  {
    "code": "1502",
    "name": "Kabupaten Merangin",
    "level": "city",
    "parentCode": "15",
    "postalCode": null,
    "latitude": -2.06,
    "longitude": 102.274
  },
  {
    "code": "1503",
    "name": "Kabupaten Sarolangun",
    "level": "city",
    "parentCode": "15",
    "postalCode": null,
    "latitude": -2.313,
    "longitude": 102.75
  },
  {
    "code": "1504",
    "name": "Kabupaten Batanghari",
    "level": "city",
    "parentCode": "15",
    "postalCode": null,
    "latitude": -1.694,
    "longitude": 103.273
  },
  {
    "code": "1505",
    "name": "Kabupaten Muaro Jambi",
    "level": "city",
    "parentCode": "15",
    "postalCode": null,
    "latitude": -1.448,
    "longitude": 103.515
  },
  {
    "code": "1506",
    "name": "Kabupaten Tanjung Jabung Barat",
    "level": "city",
    "parentCode": "15",
    "postalCode": null,
    "latitude": -1.206,
    "longitude": 103.79
  },
  {
    "code": "1507",
    "name": "Kabupaten Tanjung Jabung Timur",
    "level": "city",
    "parentCode": "15",
    "postalCode": null,
    "latitude": -0.827,
    "longitude": 103.461
  },
  {
    "code": "1508",
    "name": "Kabupaten Bungo",
    "level": "city",
    "parentCode": "15",
    "postalCode": null,
    "latitude": -1.466,
    "longitude": 102.358
  },
  {
    "code": "1509",
    "name": "Kabupaten Tebo",
    "level": "city",
    "parentCode": "15",
    "postalCode": null,
    "latitude": -1.516,
    "longitude": 102.119
  },
  {
    "code": "1571",
    "name": "Kota Jambi",
    "level": "city",
    "parentCode": "15",
    "postalCode": null,
    "latitude": -1.631,
    "longitude": 103.607
  },
  {
    "code": "1572",
    "name": "Kota Sungai Penuh",
    "level": "city",
    "parentCode": "15",
    "postalCode": null,
    "latitude": -2.071,
    "longitude": 101.396
  },
  {
    "code": "1601",
    "name": "Kabupaten Ogan Komering Ulu",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -4.166,
    "longitude": 104.198
  },
  {
    "code": "1602",
    "name": "Kabupaten Ogan Komering Ilir",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -3.412,
    "longitude": 104.823
  },
  {
    "code": "1603",
    "name": "Kabupaten Muara Enim",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -3.656,
    "longitude": 103.777
  },
  {
    "code": "1604",
    "name": "Kabupaten Lahat",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -3.778,
    "longitude": 103.55
  },
  {
    "code": "1605",
    "name": "Kabupaten Musi Rawas",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -3.244,
    "longitude": 103.012
  },
  {
    "code": "1606",
    "name": "Kabupaten Musi Banyuasin",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -2.889,
    "longitude": 103.84
  },
  {
    "code": "1607",
    "name": "Kabupaten Banyuasin",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -2.917,
    "longitude": 104.407
  },
  {
    "code": "1608",
    "name": "Kabupaten Ogan Komering Ulu Timur",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -4.532,
    "longitude": 104.095
  },
  {
    "code": "1609",
    "name": "Kabupaten Ogan Komering Ulu Selatan",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -4.369,
    "longitude": 104.358
  },
  {
    "code": "1610",
    "name": "Kabupaten Ogan Ilir",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -3.261,
    "longitude": 104.653
  },
  {
    "code": "1611",
    "name": "Kabupaten Empat Lawang",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -3.61,
    "longitude": 103.103
  },
  {
    "code": "1612",
    "name": "Kabupaten Penukal Abab Lematang Ilir",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -3.31,
    "longitude": 103.884
  },
  {
    "code": "1613",
    "name": "Kabupaten Musi Rawas Utara",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -2.735,
    "longitude": 102.901
  },
  {
    "code": "1671",
    "name": "Kota Palembang",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -2.991,
    "longitude": 104.757
  },
  {
    "code": "1672",
    "name": "Kota Pagar Alam",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -3.326,
    "longitude": 102.825
  },
  {
    "code": "1673",
    "name": "Kota Lubuk Linggau",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -3.369,
    "longitude": 104.308
  },
  {
    "code": "1674",
    "name": "Kota Prabumulih",
    "level": "city",
    "parentCode": "16",
    "postalCode": null,
    "latitude": -4.039,
    "longitude": 103.197
  },
  {
    "code": "1701",
    "name": "Kabupaten Bengkulu Selatan",
    "level": "city",
    "parentCode": "17",
    "postalCode": null,
    "latitude": -4.44,
    "longitude": 102.895
  },
  {
    "code": "1702",
    "name": "Kabupaten Rejang Lebong",
    "level": "city",
    "parentCode": "17",
    "postalCode": null,
    "latitude": -3.478,
    "longitude": 102.532
  },
  {
    "code": "1703",
    "name": "Kabupaten Bengkulu Utara",
    "level": "city",
    "parentCode": "17",
    "postalCode": null,
    "latitude": -3.437,
    "longitude": 102.202
  },
  {
    "code": "1704",
    "name": "Kabupaten Kaur",
    "level": "city",
    "parentCode": "17",
    "postalCode": null,
    "latitude": -4.759,
    "longitude": 103.349
  },
  {
    "code": "1705",
    "name": "Kabupaten Seluma",
    "level": "city",
    "parentCode": "17",
    "postalCode": null,
    "latitude": -4.078,
    "longitude": 102.556
  },
  {
    "code": "1706",
    "name": "Kabupaten Mukomuko",
    "level": "city",
    "parentCode": "17",
    "postalCode": null,
    "latitude": -2.553,
    "longitude": 101.104
  },
  {
    "code": "1707",
    "name": "Kabupaten Lebong",
    "level": "city",
    "parentCode": "17",
    "postalCode": null,
    "latitude": -3.157,
    "longitude": 102.183
  },
  {
    "code": "1708",
    "name": "Kabupaten Kepahiang",
    "level": "city",
    "parentCode": "17",
    "postalCode": null,
    "latitude": -3.625,
    "longitude": 102.556
  },
  {
    "code": "1709",
    "name": "Kabupaten Bengkulu Tengah",
    "level": "city",
    "parentCode": "17",
    "postalCode": null,
    "latitude": -3.773,
    "longitude": 102.39
  },
  {
    "code": "1771",
    "name": "Kota Bengkulu",
    "level": "city",
    "parentCode": "17",
    "postalCode": null,
    "latitude": -3.793,
    "longitude": 102.261
  },
  {
    "code": "1801",
    "name": "Kabupaten Lampung Selatan",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -4.829,
    "longitude": 104.887
  },
  {
    "code": "1802",
    "name": "Kabupaten Lampung Tengah",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -4.495,
    "longitude": 105.22
  },
  {
    "code": "1803",
    "name": "Kabupaten Lampung Utara",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -5.481,
    "longitude": 104.682
  },
  {
    "code": "1804",
    "name": "Kabupaten Lampung Barat",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -5.718,
    "longitude": 105.585
  },
  {
    "code": "1805",
    "name": "Kabupaten Tulang Bawang",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -4.506,
    "longitude": 104.511
  },
  {
    "code": "1806",
    "name": "Kabupaten Tanggamus",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -4.977,
    "longitude": 105.21
  },
  {
    "code": "1807",
    "name": "Kabupaten Lampung Timur",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -5.019,
    "longitude": 104.061
  },
  {
    "code": "1808",
    "name": "Kabupaten Way Kanan",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -5.048,
    "longitude": 105.528
  },
  {
    "code": "1809",
    "name": "Kabupaten Pesawaran",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -5.398,
    "longitude": 105.07
  },
  {
    "code": "1810",
    "name": "Kabupaten Pringsewu",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -5.344,
    "longitude": 105.006
  },
  {
    "code": "1811",
    "name": "Kabupaten Mesuji",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -3.873,
    "longitude": 105.428
  },
  {
    "code": "1812",
    "name": "Kabupaten Tulang Bawang Barat",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -4.499,
    "longitude": 105.12
  },
  {
    "code": "1813",
    "name": "Kabupaten Pesisir Barat",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -5.188,
    "longitude": 103.935
  },
  {
    "code": "1871",
    "name": "Kota Bandar Lampung",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -5.43,
    "longitude": 105.263
  },
  {
    "code": "1872",
    "name": "Kota Metro",
    "level": "city",
    "parentCode": "18",
    "postalCode": null,
    "latitude": -5.114,
    "longitude": 105.307
  },
  {
    "code": "1901",
    "name": "Kabupaten Bangka",
    "level": "city",
    "parentCode": "19",
    "postalCode": null,
    "latitude": -1.887,
    "longitude": 106.105
  },
  {
    "code": "1902",
    "name": "Kabupaten Belitung",
    "level": "city",
    "parentCode": "19",
    "postalCode": null,
    "latitude": -2.742,
    "longitude": 107.654
  },
  {
    "code": "1903",
    "name": "Kabupaten Bangka Selatan",
    "level": "city",
    "parentCode": "19",
    "postalCode": null,
    "latitude": -2.059,
    "longitude": 105.201
  },
  {
    "code": "1904",
    "name": "Kabupaten Bangka Tengah",
    "level": "city",
    "parentCode": "19",
    "postalCode": null,
    "latitude": -2.515,
    "longitude": 106.416
  },
  {
    "code": "1905",
    "name": "Kabupaten Bangka Barat",
    "level": "city",
    "parentCode": "19",
    "postalCode": null,
    "latitude": -3.02,
    "longitude": 106.512
  },
  {
    "code": "1906",
    "name": "Kabupaten Belitung Timur",
    "level": "city",
    "parentCode": "19",
    "postalCode": null,
    "latitude": -2.883,
    "longitude": 108.239
  },
  {
    "code": "1971",
    "name": "Kota Pangkal Pinang",
    "level": "city",
    "parentCode": "19",
    "postalCode": null,
    "latitude": -2.141,
    "longitude": 106.116
  },
  {
    "code": "2101",
    "name": "Kabupaten Bintan",
    "level": "city",
    "parentCode": "21",
    "postalCode": null,
    "latitude": 1.033,
    "longitude": 103.376
  },
  {
    "code": "2102",
    "name": "Kabupaten Karimun",
    "level": "city",
    "parentCode": "21",
    "postalCode": null,
    "latitude": 1.087,
    "longitude": 104.502
  },
  {
    "code": "2103",
    "name": "Kabupaten Natuna",
    "level": "city",
    "parentCode": "21",
    "postalCode": null,
    "latitude": 3.923,
    "longitude": 108.337
  },
  {
    "code": "2104",
    "name": "Kabupaten Lingga",
    "level": "city",
    "parentCode": "21",
    "postalCode": null,
    "latitude": -0.21,
    "longitude": 104.605
  },
  {
    "code": "2105",
    "name": "Kabupaten Kepulauan Anambas",
    "level": "city",
    "parentCode": "21",
    "postalCode": null,
    "latitude": 3.215,
    "longitude": 106.249
  },
  {
    "code": "2171",
    "name": "Kota Batam",
    "level": "city",
    "parentCode": "21",
    "postalCode": null,
    "latitude": 1.129,
    "longitude": 104.055
  },
  {
    "code": "2172",
    "name": "Kota Tanjung Pinang",
    "level": "city",
    "parentCode": "21",
    "postalCode": null,
    "latitude": 0.965,
    "longitude": 104.441
  },
  {
    "code": "3101",
    "name": "Kabupaten Administrasi Kepulauan Seribu",
    "level": "city",
    "parentCode": "31",
    "postalCode": null,
    "latitude": -5.746,
    "longitude": 106.613
  },
  {
    "code": "3171",
    "name": "Kota Administrasi Jakarta Pusat",
    "level": "city",
    "parentCode": "31",
    "postalCode": null,
    "latitude": -6.184,
    "longitude": 106.737
  },
  {
    "code": "3172",
    "name": "Kota Administrasi Jakarta Utara ",
    "level": "city",
    "parentCode": "31",
    "postalCode": null,
    "latitude": -6.214,
    "longitude": 106.944
  },
  {
    "code": "3173",
    "name": "Kota Administrasi Jakarta Barat",
    "level": "city",
    "parentCode": "31",
    "postalCode": null,
    "latitude": -6.248,
    "longitude": 106.808
  },
  {
    "code": "3174",
    "name": "Kota Administrasi Jakarta Selatan",
    "level": "city",
    "parentCode": "31",
    "postalCode": null,
    "latitude": -6.173,
    "longitude": 106.819
  },
  {
    "code": "3175",
    "name": "Kota Administrasi Jakarta Timur",
    "level": "city",
    "parentCode": "31",
    "postalCode": null,
    "latitude": -6.12,
    "longitude": 106.892
  },
  {
    "code": "3201",
    "name": "Kabupaten Bogor",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.479,
    "longitude": 106.825
  },
  {
    "code": "3202",
    "name": "Kabupaten Sukabumi",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.989,
    "longitude": 106.55
  },
  {
    "code": "3203",
    "name": "Kabupaten Cianjur",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.823,
    "longitude": 107.139
  },
  {
    "code": "3204",
    "name": "Kabupaten Bandung",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -7.022,
    "longitude": 107.528
  },
  {
    "code": "3205",
    "name": "Kabupaten Garut",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -7.203,
    "longitude": 107.886
  },
  {
    "code": "3206",
    "name": "Kabupaten Tasikmalaya",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -7.361,
    "longitude": 108.113
  },
  {
    "code": "3207",
    "name": "Kabupaten Ciamis",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -7.326,
    "longitude": 108.351
  },
  {
    "code": "3208",
    "name": "Kabupaten Kuningan",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.976,
    "longitude": 108.483
  },
  {
    "code": "3209",
    "name": "Kabupaten Cirebon",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.765,
    "longitude": 108.479
  },
  {
    "code": "3210",
    "name": "Kabupaten Majalengka",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.836,
    "longitude": 108.228
  },
  {
    "code": "3211",
    "name": "Kabupaten Sumedang",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.861,
    "longitude": 107.921
  },
  {
    "code": "3212",
    "name": "Kabupaten Indramayu",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.327,
    "longitude": 108.323
  },
  {
    "code": "3213",
    "name": "Kabupaten Subang",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.571,
    "longitude": 107.762
  },
  {
    "code": "3214",
    "name": "Kabupaten Purwakarta",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.556,
    "longitude": 107.441
  },
  {
    "code": "3215",
    "name": "Kabupaten Karawang",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.302,
    "longitude": 107.305
  },
  {
    "code": "3216",
    "name": "Kabupaten Bekasi",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.247,
    "longitude": 107.148
  },
  {
    "code": "3217",
    "name": "Kabupaten Bandung Barat",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.865,
    "longitude": 107.492
  },
  {
    "code": "3218",
    "name": "Kabupaten Pangandaran",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -7.615,
    "longitude": 108.499
  },
  {
    "code": "3271",
    "name": "Kota Bogor",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.595,
    "longitude": 106.794
  },
  {
    "code": "3272",
    "name": "Kota Sukabumi",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.918,
    "longitude": 106.932
  },
  {
    "code": "3273",
    "name": "Kota Bandung",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.911,
    "longitude": 107.61
  },
  {
    "code": "3274",
    "name": "Kota Cirebon",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.707,
    "longitude": 108.558
  },
  {
    "code": "3275",
    "name": "Kota Bekasi",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.236,
    "longitude": 106.994
  },
  {
    "code": "3276",
    "name": "Kota Depok",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.394,
    "longitude": 106.823
  },
  {
    "code": "3277",
    "name": "Kota Cimahi",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -6.871,
    "longitude": 107.555
  },
  {
    "code": "3278",
    "name": "Kota Tasikmalaya",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -7.316,
    "longitude": 108.197
  },
  {
    "code": "3279",
    "name": "Kota Banjar",
    "level": "city",
    "parentCode": "32",
    "postalCode": null,
    "latitude": -7.362,
    "longitude": 108.56
  },
  {
    "code": "3301",
    "name": "Kabupaten Cilacap",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.726,
    "longitude": 109.01
  },
  {
    "code": "3302",
    "name": "Kabupaten Banyumas",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.423,
    "longitude": 109.23
  },
  {
    "code": "3303",
    "name": "Kabupaten Purbalingga",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.389,
    "longitude": 109.364
  },
  {
    "code": "3304",
    "name": "Kabupaten Banjarnegara",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.396,
    "longitude": 109.696
  },
  {
    "code": "3305",
    "name": "Kabupaten Kebumen",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.668,
    "longitude": 109.654
  },
  {
    "code": "3306",
    "name": "Kabupaten Purworejo",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.714,
    "longitude": 110.008
  },
  {
    "code": "3307",
    "name": "Kabupaten Wonosobo",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.358,
    "longitude": 109.905
  },
  {
    "code": "3308",
    "name": "Kabupaten Magelang",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.597,
    "longitude": 110.224
  },
  {
    "code": "3309",
    "name": "Kabupaten Boyolali",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.546,
    "longitude": 110.611
  },
  {
    "code": "3310",
    "name": "Kabupaten Klaten",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.712,
    "longitude": 110.592
  },
  {
    "code": "3311",
    "name": "Kabupaten Sukoharjo",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.665,
    "longitude": 110.836
  },
  {
    "code": "3312",
    "name": "Kabupaten Wonogiri",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.815,
    "longitude": 110.926
  },
  {
    "code": "3313",
    "name": "Kabupaten Karanganyar",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.596,
    "longitude": 110.94
  },
  {
    "code": "3314",
    "name": "Kabupaten Sragen",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.426,
    "longitude": 111.023
  },
  {
    "code": "3315",
    "name": "Kabupaten Grobogan",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.082,
    "longitude": 110.917
  },
  {
    "code": "3316",
    "name": "Kabupaten Blora",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.97,
    "longitude": 111.415
  },
  {
    "code": "3317",
    "name": "Kabupaten Rembang",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.703,
    "longitude": 111.343
  },
  {
    "code": "3318",
    "name": "Kabupaten Pati",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.752,
    "longitude": 111.04
  },
  {
    "code": "3319",
    "name": "Kabupaten Kudus",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.806,
    "longitude": 110.842
  },
  {
    "code": "3320",
    "name": "Kabupaten Jepara",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.59,
    "longitude": 110.668
  },
  {
    "code": "3321",
    "name": "Kabupaten Demak",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.891,
    "longitude": 110.638
  },
  {
    "code": "3322",
    "name": "Kabupaten Semarang",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.129,
    "longitude": 110.404
  },
  {
    "code": "3323",
    "name": "Kabupaten Temanggung",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.315,
    "longitude": 110.182
  },
  {
    "code": "3324",
    "name": "Kabupaten Kendal",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.923,
    "longitude": 110.204
  },
  {
    "code": "3325",
    "name": "Kabupaten Batang",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.911,
    "longitude": 109.73
  },
  {
    "code": "3326",
    "name": "Kabupaten Pekalongan",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.025,
    "longitude": 109.591
  },
  {
    "code": "3327",
    "name": "Kabupaten Pemalang",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.893,
    "longitude": 109.381
  },
  {
    "code": "3328",
    "name": "Kabupaten Tegal",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.995,
    "longitude": 109.128
  },
  {
    "code": "3329",
    "name": "Kabupaten Brebes",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.87,
    "longitude": 109.039
  },
  {
    "code": "3371",
    "name": "Kota Magelang",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.504,
    "longitude": 110.221
  },
  {
    "code": "3372",
    "name": "Kota Surakarta",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.569,
    "longitude": 110.829
  },
  {
    "code": "3373",
    "name": "Kota Salatiga",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -7.33,
    "longitude": 110.501
  },
  {
    "code": "3374",
    "name": "Kota Semarang",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.982,
    "longitude": 110.412
  },
  {
    "code": "3375",
    "name": "Kota Pekalongan",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.897,
    "longitude": 109.662
  },
  {
    "code": "3376",
    "name": "Kota Tegal",
    "level": "city",
    "parentCode": "33",
    "postalCode": null,
    "latitude": -6.87,
    "longitude": 109.137
  },
  {
    "code": "3401",
    "name": "Kabupaten Kulon Progo",
    "level": "city",
    "parentCode": "34",
    "postalCode": null,
    "latitude": -7.858,
    "longitude": 110.159
  },
  {
    "code": "3402",
    "name": "Kabupaten Bantul",
    "level": "city",
    "parentCode": "34",
    "postalCode": null,
    "latitude": -7.886,
    "longitude": 110.328
  },
  {
    "code": "3403",
    "name": "Kabupaten Gunungkidul",
    "level": "city",
    "parentCode": "34",
    "postalCode": null,
    "latitude": -7.964,
    "longitude": 110.602
  },
  {
    "code": "3404",
    "name": "Kabupaten Sleman",
    "level": "city",
    "parentCode": "34",
    "postalCode": null,
    "latitude": -7.717,
    "longitude": 110.356
  },
  {
    "code": "3471",
    "name": "Kota Yogyakarta",
    "level": "city",
    "parentCode": "34",
    "postalCode": null,
    "latitude": -7.8,
    "longitude": 110.391
  },
  {
    "code": "3501",
    "name": "Kabupaten Pacitan",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -8.194,
    "longitude": 111.103
  },
  {
    "code": "3502",
    "name": "Kabupaten Ponorogo",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.871,
    "longitude": 111.463
  },
  {
    "code": "3503",
    "name": "Kabupaten Trenggalek",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -8.048,
    "longitude": 111.709
  },
  {
    "code": "3504",
    "name": "Kabupaten Tulungagung",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -8.064,
    "longitude": 111.901
  },
  {
    "code": "3505",
    "name": "Kabupaten Blitar",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -8.124,
    "longitude": 112.213
  },
  {
    "code": "3506",
    "name": "Kabupaten Kediri",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.802,
    "longitude": 112.041
  },
  {
    "code": "3507",
    "name": "Kabupaten Malang",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -8.105,
    "longitude": 112.573
  },
  {
    "code": "3508",
    "name": "Kabupaten Lumajang",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -8.135,
    "longitude": 113.224
  },
  {
    "code": "3509",
    "name": "Kabupaten Jember",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -8.17,
    "longitude": 113.702
  },
  {
    "code": "3510",
    "name": "Kabupaten Banyuwangi",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -8.223,
    "longitude": 114.366
  },
  {
    "code": "3511",
    "name": "Kabupaten Bondowoso",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.914,
    "longitude": 113.822
  },
  {
    "code": "3512",
    "name": "Kabupaten Situbondo",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.707,
    "longitude": 114.002
  },
  {
    "code": "3513",
    "name": "Kabupaten Probolinggo",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.762,
    "longitude": 113.416
  },
  {
    "code": "3514",
    "name": "Kabupaten Pasuruan",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.649,
    "longitude": 112.905
  },
  {
    "code": "3515",
    "name": "Kabupaten Sidoarjo",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.447,
    "longitude": 112.718
  },
  {
    "code": "3516",
    "name": "Kabupaten Mojokerto",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.463,
    "longitude": 112.433
  },
  {
    "code": "3517",
    "name": "Kabupaten Jombang",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.556,
    "longitude": 112.235
  },
  {
    "code": "3518",
    "name": "Kabupaten Nganjuk",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.602,
    "longitude": 111.902
  },
  {
    "code": "3519",
    "name": "Kabupaten Madiun",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.539,
    "longitude": 111.653
  },
  {
    "code": "3520",
    "name": "Kabupaten Magetan",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.656,
    "longitude": 111.329
  },
  {
    "code": "3521",
    "name": "Kabupaten Ngawi",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.401,
    "longitude": 111.445
  },
  {
    "code": "3522",
    "name": "Kabupaten Bojonegoro",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.15,
    "longitude": 111.882
  },
  {
    "code": "3523",
    "name": "Kabupaten Tuban",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -6.896,
    "longitude": 112.065
  },
  {
    "code": "3524",
    "name": "Kabupaten Lamongan",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.121,
    "longitude": 112.415
  },
  {
    "code": "3525",
    "name": "Kabupaten Gresik",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.171,
    "longitude": 112.6
  },
  {
    "code": "3526",
    "name": "Kabupaten Bangkalan",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.046,
    "longitude": 112.737
  },
  {
    "code": "3527",
    "name": "Kabupaten Sampang",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.188,
    "longitude": 113.237
  },
  {
    "code": "3528",
    "name": "Kabupaten Pamekasan",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.157,
    "longitude": 113.472
  },
  {
    "code": "3529",
    "name": "Kabupaten Sumenep",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.014,
    "longitude": 113.864
  },
  {
    "code": "3571",
    "name": "Kota Kediri",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.812,
    "longitude": 112.014
  },
  {
    "code": "3572",
    "name": "Kota Blitar",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -8.099,
    "longitude": 112.165
  },
  {
    "code": "3573",
    "name": "Kota Malang",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.978,
    "longitude": 112.634
  },
  {
    "code": "3574",
    "name": "Kota Probolinggo",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.754,
    "longitude": 113.214
  },
  {
    "code": "3575",
    "name": "Kota Pasuruan",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.647,
    "longitude": 112.909
  },
  {
    "code": "3576",
    "name": "Kota Mojokerto",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.463,
    "longitude": 112.433
  },
  {
    "code": "3577",
    "name": "Kota Madiun",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.624,
    "longitude": 111.521
  },
  {
    "code": "3578",
    "name": "Kota Surabaya",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.259,
    "longitude": 112.747
  },
  {
    "code": "3579",
    "name": "Kota Batu",
    "level": "city",
    "parentCode": "35",
    "postalCode": null,
    "latitude": -7.863,
    "longitude": 112.513
  },
  {
    "code": "3601",
    "name": "Kabupaten Pandeglang",
    "level": "city",
    "parentCode": "36",
    "postalCode": null,
    "latitude": -6.317,
    "longitude": 106.115
  },
  {
    "code": "3602",
    "name": "Kabupaten Lebak",
    "level": "city",
    "parentCode": "36",
    "postalCode": null,
    "latitude": -6.361,
    "longitude": 106.246
  },
  {
    "code": "3603",
    "name": "Kabupaten Tangerang",
    "level": "city",
    "parentCode": "36",
    "postalCode": null,
    "latitude": -6.27,
    "longitude": 106.484
  },
  {
    "code": "3604",
    "name": "Kabupaten Serang",
    "level": "city",
    "parentCode": "36",
    "postalCode": null,
    "latitude": -6.115,
    "longitude": 106.152
  },
  {
    "code": "3671",
    "name": "Kota Tangerang",
    "level": "city",
    "parentCode": "36",
    "postalCode": null,
    "latitude": -6.164,
    "longitude": 106.641
  },
  {
    "code": "3672",
    "name": "Kota Cilegon",
    "level": "city",
    "parentCode": "36",
    "postalCode": null,
    "latitude": -6.01,
    "longitude": 106.042
  },
  {
    "code": "3673",
    "name": "Kota Serang",
    "level": "city",
    "parentCode": "36",
    "postalCode": null,
    "latitude": -6.12,
    "longitude": 106.173
  },
  {
    "code": "3674",
    "name": "Kota Tangerang Selatan",
    "level": "city",
    "parentCode": "36",
    "postalCode": null,
    "latitude": -6.322,
    "longitude": 106.708
  },
  {
    "code": "5101",
    "name": "Kabupaten Jembrana",
    "level": "city",
    "parentCode": "51",
    "postalCode": null,
    "latitude": -8.357,
    "longitude": 114.637
  },
  {
    "code": "5102",
    "name": "Kabupaten Tabanan",
    "level": "city",
    "parentCode": "51",
    "postalCode": null,
    "latitude": -8.539,
    "longitude": 115.131
  },
  {
    "code": "5103",
    "name": "Kabupaten Badung",
    "level": "city",
    "parentCode": "51",
    "postalCode": null,
    "latitude": -8.602,
    "longitude": 115.179
  },
  {
    "code": "5104",
    "name": "Kabupaten Gianyar",
    "level": "city",
    "parentCode": "51",
    "postalCode": null,
    "latitude": -8.541,
    "longitude": 115.324
  },
  {
    "code": "5105",
    "name": "Kabupaten Klungkung",
    "level": "city",
    "parentCode": "51",
    "postalCode": null,
    "latitude": -8.534,
    "longitude": 115.403
  },
  {
    "code": "5106",
    "name": "Kabupaten Bangli",
    "level": "city",
    "parentCode": "51",
    "postalCode": null,
    "latitude": -8.462,
    "longitude": 115.352
  },
  {
    "code": "5107",
    "name": "Kabupaten Karangasem",
    "level": "city",
    "parentCode": "51",
    "postalCode": null,
    "latitude": -8.439,
    "longitude": 115.612
  },
  {
    "code": "5108",
    "name": "Kabupaten Buleleng",
    "level": "city",
    "parentCode": "51",
    "postalCode": null,
    "latitude": -8.125,
    "longitude": 115.093
  },
  {
    "code": "5171",
    "name": "Kota Denpasar",
    "level": "city",
    "parentCode": "51",
    "postalCode": null,
    "latitude": -8.654,
    "longitude": 115.217
  },
  {
    "code": "5201",
    "name": "Kabupaten Lombok Barat",
    "level": "city",
    "parentCode": "52",
    "postalCode": null,
    "latitude": -8.681,
    "longitude": 116.137
  },
  {
    "code": "5202",
    "name": "Kabupaten Lombok Tengah",
    "level": "city",
    "parentCode": "52",
    "postalCode": null,
    "latitude": -8.706,
    "longitude": 116.27
  },
  {
    "code": "5203",
    "name": "Kabupaten Lombok Timur",
    "level": "city",
    "parentCode": "52",
    "postalCode": null,
    "latitude": -8.651,
    "longitude": 116.53
  },
  {
    "code": "5204",
    "name": "Kabupaten Sumbawa",
    "level": "city",
    "parentCode": "52",
    "postalCode": null,
    "latitude": -8.49,
    "longitude": 117.42
  },
  {
    "code": "5205",
    "name": "Kabupaten Dompu",
    "level": "city",
    "parentCode": "52",
    "postalCode": null,
    "latitude": -8.534,
    "longitude": 118.465
  },
  {
    "code": "5206",
    "name": "Kabupaten Bima",
    "level": "city",
    "parentCode": "52",
    "postalCode": null,
    "latitude": -8.557,
    "longitude": 118.67
  },
  {
    "code": "5207",
    "name": "Kabupaten Sumbawa Barat",
    "level": "city",
    "parentCode": "52",
    "postalCode": null,
    "latitude": -8.754,
    "longitude": 116.854
  },
  {
    "code": "5208",
    "name": "Kabupaten Lombok Utara",
    "level": "city",
    "parentCode": "52",
    "postalCode": null,
    "latitude": -8.356,
    "longitude": 116.159
  },
  {
    "code": "5271",
    "name": "Kota Mataram",
    "level": "city",
    "parentCode": "52",
    "postalCode": null,
    "latitude": -8.583,
    "longitude": 116.108
  },
  {
    "code": "5272",
    "name": "Kota Bima",
    "level": "city",
    "parentCode": "52",
    "postalCode": null,
    "latitude": -8.462,
    "longitude": 118.749
  },
  {
    "code": "5301",
    "name": "Kabupaten Kupang",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -9.457,
    "longitude": 124.475
  },
  {
    "code": "5302",
    "name": "Kabupaten Timor Tengah Selatan",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -9.106,
    "longitude": 124.874
  },
  {
    "code": "5303",
    "name": "Kabupaten Timor Tengah Utara",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -8.209,
    "longitude": 124.573
  },
  {
    "code": "5304",
    "name": "Kabupaten Belu",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -8.326,
    "longitude": 123.003
  },
  {
    "code": "5305",
    "name": "Kabupaten Alor",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -8.617,
    "longitude": 122.208
  },
  {
    "code": "5306",
    "name": "Kabupaten Flores Timur",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -8.785,
    "longitude": 120.975
  },
  {
    "code": "5307",
    "name": "Kabupaten Sikka",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -8.611,
    "longitude": 120.464
  },
  {
    "code": "5308",
    "name": "Kabupaten Ende",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -9.661,
    "longitude": 120.261
  },
  {
    "code": "5309",
    "name": "Kabupaten Ngada",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -9.647,
    "longitude": 119.394
  },
  {
    "code": "5310",
    "name": "Kabupaten Manggarai",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -8.36,
    "longitude": 123.459
  },
  {
    "code": "5311",
    "name": "Kabupaten Sumba Timur",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -9.852,
    "longitude": 124.266
  },
  {
    "code": "5312",
    "name": "Kabupaten Sumba Barat",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -10.073,
    "longitude": 123.864
  },
  {
    "code": "5313",
    "name": "Kabupaten Lembata",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -8.843,
    "longitude": 121.662
  },
  {
    "code": "5314",
    "name": "Kabupaten Rote Ndao",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -10.758,
    "longitude": 123.063
  },
  {
    "code": "5315",
    "name": "Kabupaten Manggarai Barat",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -8.496,
    "longitude": 119.894
  },
  {
    "code": "5316",
    "name": "Kabupaten Nagekeo",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -9.392,
    "longitude": 119.181
  },
  {
    "code": "5317",
    "name": "Kabupaten Sumba Tengah",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -8.575,
    "longitude": 121.281
  },
  {
    "code": "5318",
    "name": "Kabupaten Sumba Barat Daya",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -9.623,
    "longitude": 119.6
  },
  {
    "code": "5319",
    "name": "Kabupaten Manggarai Timur",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -8.749,
    "longitude": 120.609
  },
  {
    "code": "5320",
    "name": "Kabupaten Sabu Raijua",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -10.453,
    "longitude": 121.878
  },
  {
    "code": "5321",
    "name": "Kabupaten Malaka",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -9.445,
    "longitude": 124.918
  },
  {
    "code": "5371",
    "name": "Kota Kupang",
    "level": "city",
    "parentCode": "53",
    "postalCode": null,
    "latitude": -10.154,
    "longitude": 123.619
  },
  {
    "code": "6101",
    "name": "Kabupaten Sambas",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": 1.361,
    "longitude": 109.329
  },
  {
    "code": "6102",
    "name": "Kabupaten Mempawah",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": -1.844,
    "longitude": 109.979
  },
  {
    "code": "6103",
    "name": "Kabupaten Sanggau",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": 0.079,
    "longitude": 111.495
  },
  {
    "code": "6104",
    "name": "Kabupaten Ketapang",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": 0.879,
    "longitude": 112.925
  },
  {
    "code": "6105",
    "name": "Kabupaten Sintang",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": 0.869,
    "longitude": 109.497
  },
  {
    "code": "6106",
    "name": "Kabupaten Kapuas Hulu",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": 0.375,
    "longitude": 109.938
  },
  {
    "code": "6107",
    "name": "Kabupaten Bengkayang",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": 0.351,
    "longitude": 108.962
  },
  {
    "code": "6108",
    "name": "Kabupaten Landak",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": 0.123,
    "longitude": 110.596
  },
  {
    "code": "6109",
    "name": "Kabupaten Sekadau",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": 0.007,
    "longitude": 110.955
  },
  {
    "code": "6110",
    "name": "Kabupaten Melawi",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": -0.377,
    "longitude": 111.764
  },
  {
    "code": "6111",
    "name": "Kabupaten Kayong Utara",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": -1.253,
    "longitude": 109.954
  },
  {
    "code": "6112",
    "name": "Kabupaten Kubu Raya",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": -0.127,
    "longitude": 109.404
  },
  {
    "code": "6171",
    "name": "Kota Pontianak",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": -0.022,
    "longitude": 109.338
  },
  {
    "code": "6172",
    "name": "Kota Singkawang",
    "level": "city",
    "parentCode": "61",
    "postalCode": null,
    "latitude": 0.905,
    "longitude": 108.977
  },
  {
    "code": "6201",
    "name": "Kabupaten Kotawaringin Barat",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -2.692,
    "longitude": 111.634
  },
  {
    "code": "6202",
    "name": "Kabupaten Kotawaringin Timur",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -2.538,
    "longitude": 112.941
  },
  {
    "code": "6203",
    "name": "Kabupaten Kapuas",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -2.964,
    "longitude": 114.416
  },
  {
    "code": "6204",
    "name": "Kabupaten Barito Selatan",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -1.719,
    "longitude": 114.845
  },
  {
    "code": "6205",
    "name": "Kabupaten Barito Utara",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -0.952,
    "longitude": 114.898
  },
  {
    "code": "6206",
    "name": "Kabupaten Katingan",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -2.185,
    "longitude": 111.428
  },
  {
    "code": "6207",
    "name": "Kabupaten Seruyan",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -2.761,
    "longitude": 111.177
  },
  {
    "code": "6208",
    "name": "Kabupaten Sukamara",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -1.881,
    "longitude": 113.399
  },
  {
    "code": "6209",
    "name": "Kabupaten Lamandau",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -3.414,
    "longitude": 112.542
  },
  {
    "code": "6210",
    "name": "Kabupaten Gunung Mas",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -2.716,
    "longitude": 114.305
  },
  {
    "code": "6211",
    "name": "Kabupaten Pulang Pisau",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -1.127,
    "longitude": 113.844
  },
  {
    "code": "6212",
    "name": "Kabupaten Murung Raya",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -2.115,
    "longitude": 115.169
  },
  {
    "code": "6213",
    "name": "Kabupaten Barito Timur",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -0.64,
    "longitude": 114.569
  },
  {
    "code": "6271",
    "name": "Kota Palangkaraya",
    "level": "city",
    "parentCode": "62",
    "postalCode": null,
    "latitude": -2.174,
    "longitude": 113.88
  },
  {
    "code": "6301",
    "name": "Kabupaten Tanah Laut",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -3.799,
    "longitude": 114.783
  },
  {
    "code": "6302",
    "name": "Kabupaten Kotabaru",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -3.236,
    "longitude": 116.228
  },
  {
    "code": "6303",
    "name": "Kabupaten Banjar",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -3.409,
    "longitude": 114.848
  },
  {
    "code": "6304",
    "name": "Kabupaten Barito Kuala",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -2.978,
    "longitude": 114.766
  },
  {
    "code": "6305",
    "name": "Kabupaten Tapin",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -2.932,
    "longitude": 115.163
  },
  {
    "code": "6306",
    "name": "Kabupaten Hulu Sungai Selatan",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -2.787,
    "longitude": 115.266
  },
  {
    "code": "6307",
    "name": "Kabupaten Hulu Sungai Tengah",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -2.585,
    "longitude": 115.385
  },
  {
    "code": "6308",
    "name": "Kabupaten Hulu Sungai Utara",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -2.419,
    "longitude": 115.254
  },
  {
    "code": "6309",
    "name": "Kabupaten Tabalong",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -2.164,
    "longitude": 115.382
  },
  {
    "code": "6310",
    "name": "Kabupaten Tanah Bumbu",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -3.483,
    "longitude": 115.947
  },
  {
    "code": "6311",
    "name": "Kabupaten Balangan",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -2.364,
    "longitude": 115.471
  },
  {
    "code": "6371",
    "name": "Kota Banjarmasin",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -3.327,
    "longitude": 114.589
  },
  {
    "code": "6372",
    "name": "Kota Banjarbaru",
    "level": "city",
    "parentCode": "63",
    "postalCode": null,
    "latitude": -3.439,
    "longitude": 114.831
  },
  {
    "code": "6401",
    "name": "Kabupaten Paser",
    "level": "city",
    "parentCode": "64",
    "postalCode": null,
    "latitude": -1.91,
    "longitude": 116.191
  },
  {
    "code": "6402",
    "name": "Kabupaten Kutai Kartanegara",
    "level": "city",
    "parentCode": "64",
    "postalCode": null,
    "latitude": 2.15,
    "longitude": 117.508
  },
  {
    "code": "6403",
    "name": "Kabupaten Berau",
    "level": "city",
    "parentCode": "64",
    "postalCode": null,
    "latitude": 2.045,
    "longitude": 117.362
  },
  {
    "code": "6407",
    "name": "Kabupaten Kutai Barat",
    "level": "city",
    "parentCode": "64",
    "postalCode": null,
    "latitude": -0.443,
    "longitude": 116.999
  },
  {
    "code": "6408",
    "name": "Kabupaten Kutai Timur",
    "level": "city",
    "parentCode": "64",
    "postalCode": null,
    "latitude": 0.943,
    "longitude": 116.985
  },
  {
    "code": "6409",
    "name": "Kabupaten Penajam Paser Utara",
    "level": "city",
    "parentCode": "64",
    "postalCode": null,
    "latitude": -1.308,
    "longitude": 116.727
  },
  {
    "code": "6411",
    "name": "Kabupaten Mahakam Ulu",
    "level": "city",
    "parentCode": "64",
    "postalCode": null,
    "latitude": 0.506,
    "longitude": 115.271
  },
  {
    "code": "6471",
    "name": "Kota Balikpapan",
    "level": "city",
    "parentCode": "64",
    "postalCode": null,
    "latitude": -1.276,
    "longitude": 116.828
  },
  {
    "code": "6472",
    "name": "Kota Samarinda",
    "level": "city",
    "parentCode": "64",
    "postalCode": null,
    "latitude": -0.491,
    "longitude": 117.146
  },
  {
    "code": "6474",
    "name": "Kota Bontang",
    "level": "city",
    "parentCode": "64",
    "postalCode": null,
    "latitude": 0.07,
    "longitude": 117.444
  },
  {
    "code": "6501",
    "name": "Kabupaten Bulungan",
    "level": "city",
    "parentCode": "65",
    "postalCode": null,
    "latitude": 3.552,
    "longitude": 116.622
  },
  {
    "code": "6502",
    "name": "Kabupaten Malinau",
    "level": "city",
    "parentCode": "65",
    "postalCode": null,
    "latitude": 2.841,
    "longitude": 117.398
  },
  {
    "code": "6503",
    "name": "Kabupaten Nunukan",
    "level": "city",
    "parentCode": "65",
    "postalCode": null,
    "latitude": 3.602,
    "longitude": 116.903
  },
  {
    "code": "6504",
    "name": "Kabupaten Tana Tidung",
    "level": "city",
    "parentCode": "65",
    "postalCode": null,
    "latitude": 4.077,
    "longitude": 117.719
  },
  {
    "code": "6571",
    "name": "Kota Tarakan",
    "level": "city",
    "parentCode": "65",
    "postalCode": null,
    "latitude": 3.314,
    "longitude": 117.605
  },
  {
    "code": "7101",
    "name": "Kabupaten Bolaang Mongondow",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 0.871,
    "longitude": 124.024
  },
  {
    "code": "7102",
    "name": "Kabupaten Minahasa",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 1.301,
    "longitude": 124.911
  },
  {
    "code": "7103",
    "name": "Kabupaten Kepulauan Sangihe",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 3.612,
    "longitude": 125.5
  },
  {
    "code": "7104",
    "name": "Kabupaten Kepulauan Talaud",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 4.006,
    "longitude": 126.682
  },
  {
    "code": "7105",
    "name": "Kabupaten Minahasa Selatan",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 1.213,
    "longitude": 124.597
  },
  {
    "code": "7106",
    "name": "Kabupaten Minahasa Utara",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 1.459,
    "longitude": 124.975
  },
  {
    "code": "7107",
    "name": "Kabupaten Minahasa Tenggara",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 2.745,
    "longitude": 125.362
  },
  {
    "code": "7108",
    "name": "Kabupaten Bolaang Mongondow Utara",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 1.042,
    "longitude": 124.798
  },
  {
    "code": "7109",
    "name": "Kabupaten Kep. Siau Tagulandang Biaro",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "7110",
    "name": "Kabupaten Bolaang Mongondow Timur",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 0.384,
    "longitude": 124.048
  },
  {
    "code": "7111",
    "name": "Kabupaten Bolaang Mongondow Selatan",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 0.769,
    "longitude": 124.613
  },
  {
    "code": "7171",
    "name": "Kota Manado",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 1.485,
    "longitude": 124.849
  },
  {
    "code": "7172",
    "name": "Kota Bitung",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 1.445,
    "longitude": 125.182
  },
  {
    "code": "7173",
    "name": "Kota Tomohon",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 1.315,
    "longitude": 124.827
  },
  {
    "code": "7174",
    "name": "Kota Kotamobagu",
    "level": "city",
    "parentCode": "71",
    "postalCode": null,
    "latitude": 0.743,
    "longitude": 124.313
  },
  {
    "code": "7201",
    "name": "Kabupaten Banggai",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": -1.395,
    "longitude": 120.755
  },
  {
    "code": "7202",
    "name": "Kabupaten Poso",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": 1.018,
    "longitude": 120.798
  },
  {
    "code": "7203",
    "name": "Kabupaten Donggala",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": 1.169,
    "longitude": 121.41
  },
  {
    "code": "7204",
    "name": "Kabupaten Toli-Toli",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": -2.481,
    "longitude": 121.934
  },
  {
    "code": "7205",
    "name": "Kabupaten Buol",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": -1.312,
    "longitude": 123.298
  },
  {
    "code": "7206",
    "name": "Kabupaten Morowali",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": -0.678,
    "longitude": 119.753
  },
  {
    "code": "7207",
    "name": "Kabupaten Banggai Kepulauan",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": -0.994,
    "longitude": 122.789
  },
  {
    "code": "7208",
    "name": "Kabupaten Parigi Moutong",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": -0.805,
    "longitude": 120.16
  },
  {
    "code": "7209",
    "name": "Kabupaten Tojo Una Una",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": -0.915,
    "longitude": 121.589
  },
  {
    "code": "7210",
    "name": "Kabupaten Sigi",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": -1.047,
    "longitude": 119.95
  },
  {
    "code": "7211",
    "name": "Kabupaten Banggai Laut",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": -1.606,
    "longitude": 123.496
  },
  {
    "code": "7212",
    "name": "Kabupaten Morowali Utara",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": -1.977,
    "longitude": 121.336
  },
  {
    "code": "7271",
    "name": "Kota Palu",
    "level": "city",
    "parentCode": "72",
    "postalCode": null,
    "latitude": -0.9,
    "longitude": 119.891
  },
  {
    "code": "7301",
    "name": "Kabupaten Kepulauan Selayar",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -6.12,
    "longitude": 120.466
  },
  {
    "code": "7302",
    "name": "Kabupaten Bulukumba",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -5.558,
    "longitude": 120.193
  },
  {
    "code": "7303",
    "name": "Kabupaten Bantaeng",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -5.553,
    "longitude": 119.967
  },
  {
    "code": "7304",
    "name": "Kabupaten Jeneponto",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -5.677,
    "longitude": 119.749
  },
  {
    "code": "7305",
    "name": "Kabupaten Takalar",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -5.425,
    "longitude": 119.441
  },
  {
    "code": "7306",
    "name": "Kabupaten Gowa",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -5.2,
    "longitude": 119.453
  },
  {
    "code": "7307",
    "name": "Kabupaten Sinjai",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -5.12,
    "longitude": 120.235
  },
  {
    "code": "7308",
    "name": "Kabupaten Bone",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -4.414,
    "longitude": 119.617
  },
  {
    "code": "7309",
    "name": "Kabupaten Maros",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -4.539,
    "longitude": 120.309
  },
  {
    "code": "7310",
    "name": "Kabupaten Pangkajene dan Kepulauan",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -5.016,
    "longitude": 119.574
  },
  {
    "code": "7311",
    "name": "Kabupaten Barru",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -4.846,
    "longitude": 119.56
  },
  {
    "code": "7312",
    "name": "Kabupaten Soppeng",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -4.364,
    "longitude": 119.898
  },
  {
    "code": "7313",
    "name": "Kabupaten Wajo",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -4.112,
    "longitude": 120.027
  },
  {
    "code": "7314",
    "name": "Kabupaten Sidenreng Rappang",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -3.933,
    "longitude": 119.769
  },
  {
    "code": "7315",
    "name": "Kabupaten Pinrang",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -3.809,
    "longitude": 119.65
  },
  {
    "code": "7316",
    "name": "Kabupaten Enrekang",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -3.588,
    "longitude": 119.77
  },
  {
    "code": "7317",
    "name": "Kabupaten Luwu",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -3.395,
    "longitude": 120.366
  },
  {
    "code": "7318",
    "name": "Kabupaten Tana Toraja",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -3.087,
    "longitude": 119.857
  },
  {
    "code": "7322",
    "name": "Kabupaten Luwu Utara",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -2.55,
    "longitude": 120.346
  },
  {
    "code": "7324",
    "name": "Kabupaten Luwu Timur",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -2.583,
    "longitude": 121.171
  },
  {
    "code": "7326",
    "name": "Kabupaten Toraja Utara",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -2.974,
    "longitude": 119.895
  },
  {
    "code": "7371",
    "name": "Kota Makassar",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -5.133,
    "longitude": 119.408
  },
  {
    "code": "7372",
    "name": "Kota Parepare",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -4.028,
    "longitude": 119.633
  },
  {
    "code": "7373",
    "name": "Kota Palopo",
    "level": "city",
    "parentCode": "73",
    "postalCode": null,
    "latitude": -3.008,
    "longitude": 120.202
  },
  {
    "code": "7401",
    "name": "Kabupaten Kolaka",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -5.496,
    "longitude": 122.84
  },
  {
    "code": "7402",
    "name": "Kabupaten Konawe",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -4.798,
    "longitude": 122.719
  },
  {
    "code": "7403",
    "name": "Kabupaten Muna",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -3.854,
    "longitude": 122.043
  },
  {
    "code": "7404",
    "name": "Kabupaten Buton",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -4.061,
    "longitude": 121.616
  },
  {
    "code": "7405",
    "name": "Kabupaten Konawe Selatan",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -4.332,
    "longitude": 122.281
  },
  {
    "code": "7406",
    "name": "Kabupaten Bombana",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -4.747,
    "longitude": 122.011
  },
  {
    "code": "7407",
    "name": "Kabupaten Wakatobi",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -5.328,
    "longitude": 23.539
  },
  {
    "code": "7408",
    "name": "Kabupaten Kolaka Utara",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -3.49,
    "longitude": 120.888
  },
  {
    "code": "7409",
    "name": "Kabupaten Konawe Utara",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -4.801,
    "longitude": 122.983
  },
  {
    "code": "7410",
    "name": "Kabupaten Buton Utara",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -3.512,
    "longitude": 122.111
  },
  {
    "code": "7411",
    "name": "Kabupaten Kolaka Timur",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -4.001,
    "longitude": 121.862
  },
  {
    "code": "7412",
    "name": "Kabupaten Konawe Kepulauan",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -4.053,
    "longitude": 122.989
  },
  {
    "code": "7413",
    "name": "Kabupaten Muna Barat",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -4.792,
    "longitude": 122.494
  },
  {
    "code": "7414",
    "name": "Kabupaten Buton Tengah",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -5.316,
    "longitude": 122.532
  },
  {
    "code": "7415",
    "name": "Kabupaten Buton Selatan",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -5.608,
    "longitude": 122.601
  },
  {
    "code": "7471",
    "name": "Kota Kendari",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -3.973,
    "longitude": 122.512
  },
  {
    "code": "7472",
    "name": "Kota Bau Bau",
    "level": "city",
    "parentCode": "74",
    "postalCode": null,
    "latitude": -5.485,
    "longitude": 122.585
  },
  {
    "code": "7501",
    "name": "Kabupaten Gorontalo",
    "level": "city",
    "parentCode": "75",
    "postalCode": null,
    "latitude": 0.529,
    "longitude": 122.348
  },
  {
    "code": "7502",
    "name": "Kabupaten Boalemo",
    "level": "city",
    "parentCode": "75",
    "postalCode": null,
    "latitude": 0.629,
    "longitude": 122.981
  },
  {
    "code": "7503",
    "name": "Kabupaten Bone Bolango",
    "level": "city",
    "parentCode": "75",
    "postalCode": null,
    "latitude": 0.706,
    "longitude": 121.72
  },
  {
    "code": "7504",
    "name": "Kabupaten Pohuwato",
    "level": "city",
    "parentCode": "75",
    "postalCode": null,
    "latitude": 0.557,
    "longitude": 123.144
  },
  {
    "code": "7505",
    "name": "Kabupaten Gorontalo Utara",
    "level": "city",
    "parentCode": "75",
    "postalCode": null,
    "latitude": 0.791,
    "longitude": 122.869
  },
  {
    "code": "7571",
    "name": "Kota Gorontalo",
    "level": "city",
    "parentCode": "75",
    "postalCode": null,
    "latitude": 0.532,
    "longitude": 123.06
  },
  {
    "code": "7601",
    "name": "Kabupaten Pasangkayu",
    "level": "city",
    "parentCode": "76",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "7602",
    "name": "Kabupaten Mamuju",
    "level": "city",
    "parentCode": "76",
    "postalCode": null,
    "latitude": -3.408,
    "longitude": 119.311
  },
  {
    "code": "7603",
    "name": "Kabupaten Mamasa",
    "level": "city",
    "parentCode": "76",
    "postalCode": null,
    "latitude": -2.956,
    "longitude": 119.363
  },
  {
    "code": "7604",
    "name": "Kabupaten Polewali Mandar",
    "level": "city",
    "parentCode": "76",
    "postalCode": null,
    "latitude": -2.69,
    "longitude": 118.885
  },
  {
    "code": "7605",
    "name": "Kabupaten Majene",
    "level": "city",
    "parentCode": "76",
    "postalCode": null,
    "latitude": -1.174,
    "longitude": 119.377
  },
  {
    "code": "7606",
    "name": "Kabupaten Mamuju Tengah",
    "level": "city",
    "parentCode": "76",
    "postalCode": null,
    "latitude": -2.082,
    "longitude": 119.301
  },
  {
    "code": "8101",
    "name": "Kabupaten Maluku Tengah",
    "level": "city",
    "parentCode": "81",
    "postalCode": null,
    "latitude": -7.97,
    "longitude": 131.312
  },
  {
    "code": "8102",
    "name": "Kabupaten Maluku Tenggara",
    "level": "city",
    "parentCode": "81",
    "postalCode": null,
    "latitude": -5.683,
    "longitude": 132.717
  },
  {
    "code": "8103",
    "name": "Kabupaten Kepulauan Tanimbar",
    "level": "city",
    "parentCode": "81",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "8104",
    "name": "Kabupaten Buru",
    "level": "city",
    "parentCode": "81",
    "postalCode": null,
    "latitude": -3.259,
    "longitude": 127.103
  },
  {
    "code": "8105",
    "name": "Kabupaten Seram Bagian Timur",
    "level": "city",
    "parentCode": "81",
    "postalCode": null,
    "latitude": -5.775,
    "longitude": 134.215
  },
  {
    "code": "8106",
    "name": "Kabupaten Seram Bagian Barat",
    "level": "city",
    "parentCode": "81",
    "postalCode": null,
    "latitude": -3.067,
    "longitude": 128.23
  },
  {
    "code": "8107",
    "name": "Kabupaten Kepulauan Aru",
    "level": "city",
    "parentCode": "81",
    "postalCode": null,
    "latitude": -3.104,
    "longitude": 130.489
  },
  {
    "code": "8108",
    "name": "Kabupaten Maluku Barat Daya",
    "level": "city",
    "parentCode": "81",
    "postalCode": null,
    "latitude": -8.148,
    "longitude": 127.802
  },
  {
    "code": "8109",
    "name": "Kabupaten Buru Selatan",
    "level": "city",
    "parentCode": "81",
    "postalCode": null,
    "latitude": -3.838,
    "longitude": 126.734
  },
  {
    "code": "8171",
    "name": "Kota Ambon",
    "level": "city",
    "parentCode": "81",
    "postalCode": null,
    "latitude": -3.694,
    "longitude": 128.181
  },
  {
    "code": "8172",
    "name": "Kota Tual",
    "level": "city",
    "parentCode": "81",
    "postalCode": null,
    "latitude": -5.635,
    "longitude": 132.752
  },
  {
    "code": "8201",
    "name": "Kabupaten Halmahera Barat",
    "level": "city",
    "parentCode": "82",
    "postalCode": null,
    "latitude": 1.08,
    "longitude": 127.48
  },
  {
    "code": "8202",
    "name": "Kabupaten Halmahera Tengah",
    "level": "city",
    "parentCode": "82",
    "postalCode": null,
    "latitude": 0.33,
    "longitude": 127.87
  },
  {
    "code": "8203",
    "name": "Kabupaten Halmahera Utara",
    "level": "city",
    "parentCode": "82",
    "postalCode": null,
    "latitude": -2.007,
    "longitude": 125.964
  },
  {
    "code": "8204",
    "name": "Kabupaten Halmahera Selatan",
    "level": "city",
    "parentCode": "82",
    "postalCode": null,
    "latitude": -0.645,
    "longitude": 127.505
  },
  {
    "code": "8205",
    "name": "Kabupaten Kepulauan Sula",
    "level": "city",
    "parentCode": "82",
    "postalCode": null,
    "latitude": 1.728,
    "longitude": 127.992
  },
  {
    "code": "8206",
    "name": "Kabupaten Halmahera Timur",
    "level": "city",
    "parentCode": "82",
    "postalCode": null,
    "latitude": 0.677,
    "longitude": 128.284
  },
  {
    "code": "8207",
    "name": "Kabupaten Pulau Morotai",
    "level": "city",
    "parentCode": "82",
    "postalCode": null,
    "latitude": 2.013,
    "longitude": 128.284
  },
  {
    "code": "8208",
    "name": "Kabupaten Pulau Taliabu",
    "level": "city",
    "parentCode": "82",
    "postalCode": null,
    "latitude": -1.947,
    "longitude": 124.387
  },
  {
    "code": "8271",
    "name": "Kota Ternate",
    "level": "city",
    "parentCode": "82",
    "postalCode": null,
    "latitude": 0.786,
    "longitude": 127.388
  },
  {
    "code": "8272",
    "name": "Kota Tidore Kepulauan",
    "level": "city",
    "parentCode": "82",
    "postalCode": null,
    "latitude": 0.672,
    "longitude": 127.447
  },
  {
    "code": "9103",
    "name": "Kabupaten Jayapura",
    "level": "city",
    "parentCode": "91",
    "postalCode": null,
    "latitude": -3.941,
    "longitude": 136.422
  },
  {
    "code": "9105",
    "name": "Kabupaten Kepulauan Yapen",
    "level": "city",
    "parentCode": "91",
    "postalCode": null,
    "latitude": -4.032,
    "longitude": 136.299
  },
  {
    "code": "9106",
    "name": "Kabupaten Biak Numfor",
    "level": "city",
    "parentCode": "91",
    "postalCode": null,
    "latitude": -1.038,
    "longitude": 135.98
  },
  {
    "code": "9110",
    "name": "Kabupaten Sarmi",
    "level": "city",
    "parentCode": "91",
    "postalCode": null,
    "latitude": -2.468,
    "longitude": 139.203
  },
  {
    "code": "9111",
    "name": "Kabupaten Keerom",
    "level": "city",
    "parentCode": "91",
    "postalCode": null,
    "latitude": -3.345,
    "longitude": 140.762
  },
  {
    "code": "9115",
    "name": "Kabupaten Waropen",
    "level": "city",
    "parentCode": "91",
    "postalCode": null,
    "latitude": -2.844,
    "longitude": 136.671
  },
  {
    "code": "9119",
    "name": "Kabupaten Supiori",
    "level": "city",
    "parentCode": "91",
    "postalCode": null,
    "latitude": -0.73,
    "longitude": 135.639
  },
  {
    "code": "9120",
    "name": "Kabupaten Mamberamo Raya",
    "level": "city",
    "parentCode": "91",
    "postalCode": null,
    "latitude": -2.533,
    "longitude": 137.764
  },
  {
    "code": "9171",
    "name": "Kota Jayapura",
    "level": "city",
    "parentCode": "91",
    "postalCode": null,
    "latitude": -2.592,
    "longitude": 140.669
  },
  {
    "code": "9202",
    "name": "Kabupaten Manokwari",
    "level": "city",
    "parentCode": "92",
    "postalCode": null,
    "latitude": -1.874,
    "longitude": 136.237
  },
  {
    "code": "9203",
    "name": "Kabupaten Fak Fak",
    "level": "city",
    "parentCode": "92",
    "postalCode": null,
    "latitude": -3.098,
    "longitude": 133.019
  },
  {
    "code": "9206",
    "name": "Kabupaten Teluk Bintuni",
    "level": "city",
    "parentCode": "92",
    "postalCode": null,
    "latitude": -1.906,
    "longitude": 133.329
  },
  {
    "code": "9207",
    "name": "Kabupaten Teluk Wondama",
    "level": "city",
    "parentCode": "92",
    "postalCode": null,
    "latitude": -2.55,
    "longitude": 140.477
  },
  {
    "code": "9208",
    "name": "Kabupaten Kaimana",
    "level": "city",
    "parentCode": "92",
    "postalCode": null,
    "latitude": -3.288,
    "longitude": 133.944
  },
  {
    "code": "9211",
    "name": "Kabupaten Manokwari Selatan",
    "level": "city",
    "parentCode": "92",
    "postalCode": null,
    "latitude": -2.909,
    "longitude": 140.773
  },
  {
    "code": "9212",
    "name": "Kabupaten Pegunungan Arfak",
    "level": "city",
    "parentCode": "92",
    "postalCode": null,
    "latitude": -1.155,
    "longitude": 133.714
  },
  {
    "code": "9301",
    "name": "Kabupaten Merauke",
    "level": "city",
    "parentCode": "93",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9302",
    "name": "Kabupaten Boven Digoel",
    "level": "city",
    "parentCode": "93",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9303",
    "name": "Kabupaten Mappi",
    "level": "city",
    "parentCode": "93",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9304",
    "name": "Kabupaten Asmat",
    "level": "city",
    "parentCode": "93",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9401",
    "name": "Kabupaten Nabire",
    "level": "city",
    "parentCode": "94",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9402",
    "name": "Kabupaten Puncak Jaya",
    "level": "city",
    "parentCode": "94",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9403",
    "name": "Kabupaten Paniai",
    "level": "city",
    "parentCode": "94",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9404",
    "name": "Kabupaten Mimika",
    "level": "city",
    "parentCode": "94",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9405",
    "name": "Kabupaten Puncak",
    "level": "city",
    "parentCode": "94",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9406",
    "name": "Kabupaten Dogiyai",
    "level": "city",
    "parentCode": "94",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9407",
    "name": "Kabupaten Intan Jaya",
    "level": "city",
    "parentCode": "94",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9408",
    "name": "Kabupaten Deiyai",
    "level": "city",
    "parentCode": "94",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9501",
    "name": "Kabupaten Jayawijaya",
    "level": "city",
    "parentCode": "95",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9502",
    "name": "Kabupaten Pegunungan Bintang",
    "level": "city",
    "parentCode": "95",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9503",
    "name": "Kabupaten Yahukimo",
    "level": "city",
    "parentCode": "95",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9504",
    "name": "Kabupaten Tolikara",
    "level": "city",
    "parentCode": "95",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9505",
    "name": "Kabupaten Mamberamo Tengah",
    "level": "city",
    "parentCode": "95",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9506",
    "name": "Kabupaten Yalimo",
    "level": "city",
    "parentCode": "95",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9507",
    "name": "Kabupaten Lanny Jaya",
    "level": "city",
    "parentCode": "95",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9508",
    "name": "Kabupaten Nduga",
    "level": "city",
    "parentCode": "95",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9601",
    "name": "Kabupaten Sorong",
    "level": "city",
    "parentCode": "96",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9602",
    "name": "Kabupaten Sorong Selatan",
    "level": "city",
    "parentCode": "96",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9603",
    "name": "Kabupaten Raja Ampat",
    "level": "city",
    "parentCode": "96",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9604",
    "name": "Kabupaten Tambrauw",
    "level": "city",
    "parentCode": "96",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9605",
    "name": "Kabupaten Maybrat",
    "level": "city",
    "parentCode": "96",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  },
  {
    "code": "9671",
    "name": "Kota Sorong",
    "level": "city",
    "parentCode": "96",
    "postalCode": null,
    "latitude": null,
    "longitude": null
  }
]

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT level, COUNT(*) as count FROM region WHERE level IN ('province', 'city') GROUP BY level`,
      { type: Sequelize.QueryTypes.SELECT }
    )

    const now = new Date()
    const toInsert = []

    if (!existing || existing.level !== 'province' || parseInt(existing.count) < 34) {
      for (const row of PROVINCES) {
        toInsert.push({ ...row, createdAt: now, updatedAt: now })
      }
    }

    const cityCount = await queryInterface.sequelize.query(
      `SELECT COUNT(*) as count FROM region WHERE level = 'city'`,
      { type: Sequelize.QueryTypes.SELECT }
    )

    if (!cityCount || parseInt(cityCount[0].count) < 400) {
      for (const row of CITIES) {
        toInsert.push({ ...row, createdAt: now, updatedAt: now })
      }
    }

    if (toInsert.length > 0) {
      const BATCH = 500
      for (let i = 0; i < toInsert.length; i += BATCH) {
        await queryInterface.bulkInsert('region', toInsert.slice(i, i + BATCH))
      }
      console.log(`  Seeded ${toInsert.length} region rows (provinces + cities)`)
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('region', {
      level: { [Sequelize.Op.in]: ['province', 'city'] }
    })
  }
}
