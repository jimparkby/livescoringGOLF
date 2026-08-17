export type TeeColor = "black" | "white" | "yellow" | "blue" | "red";

export type TeeInfo = {
  color: TeeColor;
  label: string;
  cssColor: string;
  rating: number;
  slope: number;
  totalMeters: number;
};

export type Hole = { number: number; par: number; hcp: number; meters: Record<TeeColor, number> };
export type Course = {
  id: string;
  name: string;
  club: string;
  address: string;
  website: string;
  phone: string;
  designer?: string;
  tees: TeeInfo[];
  totalPar: number;
  holes: Hole[];
};

export const TEE_CONFIG: Record<TeeColor, { label: string; cssColor: string; border: string }> = {
  black:  { label: "Black",  cssColor: "rgba(20,20,20,0.95)",    border: "#6b7280" },
  white:  { label: "White",  cssColor: "rgba(248,250,252,0.95)", border: "#94a3b8" },
  yellow: { label: "Yellow", cssColor: "rgba(245,158,11,0.4)",   border: "#f59e0b" },
  blue:   { label: "Blue",   cssColor: "rgba(59,130,246,0.4)",   border: "#3b82f6" },
  red:    { label: "Red",    cssColor: "rgba(239,68,68,0.4)",    border: "#ef4444" },
};

export const COURSES: Course[] = [
  {
    id: "championship",
    name: "Championship",
    club: "Golf Club Minsk",
    address: "Kalodishchi, Minsk District, Belarus",
    website: "https://golfminsk.com",
    phone: "+375 (44) 700-22-77",
    designer: "Paul Thomas",
    tees: [
      { color: "black",  label: "Black",  cssColor: "#1f2937", rating: 75.1, slope: 137, totalMeters: 6602 },
      { color: "white",  label: "White",  cssColor: "#f8fafc", rating: 71.9, slope: 131, totalMeters: 6307 },
      { color: "yellow", label: "Yellow", cssColor: "#f59e0b", rating: 70.1, slope: 125, totalMeters: 5919 },
      { color: "blue",   label: "Blue",   cssColor: "#3b82f6", rating: 69.7, slope: 125, totalMeters: 5542 },
      { color: "red",    label: "Red",    cssColor: "#ef4444", rating: 67.5, slope: 115, totalMeters: 5178 },
    ],
    totalPar: 72,
    holes: [
      { number: 1,  par: 4, hcp: 8,  meters: { black: 393, white: 371, yellow: 350, blue: 318, red: 318 } },
      { number: 2,  par: 5, hcp: 12, meters: { black: 490, white: 442, yellow: 438, blue: 413, red: 390 } },
      { number: 3,  par: 3, hcp: 18, meters: { black: 153, white: 153, yellow: 142, blue: 104, red: 104 } },
      { number: 4,  par: 4, hcp: 6,  meters: { black: 370, white: 359, yellow: 349, blue: 292, red: 286 } },
      { number: 5,  par: 4, hcp: 2,  meters: { black: 382, white: 358, yellow: 358, blue: 307, red: 307 } },
      { number: 6,  par: 4, hcp: 14, meters: { black: 343, white: 332, yellow: 294, blue: 294, red: 274 } },
      { number: 7,  par: 3, hcp: 16, meters: { black: 172, white: 172, yellow: 149, blue: 142, red: 131 } },
      { number: 8,  par: 4, hcp: 4,  meters: { black: 370, white: 332, yellow: 341, blue: 300, red: 294 } },
      { number: 9,  par: 5, hcp: 10, meters: { black: 493, white: 478, yellow: 431, blue: 420, red: 387 } },
      { number: 10, par: 4, hcp: 17, meters: { black: 358, white: 358, yellow: 320, blue: 311, red: 282 } },
      { number: 11, par: 3, hcp: 9,  meters: { black: 209, white: 200, yellow: 191, blue: 185, red: 176 } },
      { number: 12, par: 4, hcp: 1,  meters: { black: 459, white: 405, yellow: 382, blue: 374, red: 338 } },
      { number: 13, par: 5, hcp: 11, meters: { black: 482, white: 444, yellow: 444, blue: 435, red: 413 } },
      { number: 14, par: 4, hcp: 7,  meters: { black: 431, white: 425, yellow: 383, blue: 383, red: 333 } },
      { number: 15, par: 4, hcp: 5,  meters: { black: 403, white: 393, yellow: 311, blue: 311, red: 311 } },
      { number: 16, par: 3, hcp: 15, meters: { black: 180, white: 171, yellow: 158, blue: 158, red: 125 } },
      { number: 17, par: 5, hcp: 3,  meters: { black: 536, white: 536, yellow: 499, blue: 449, red: 445 } },
      { number: 18, par: 4, hcp: 13, meters: { black: 378, white: 378, yellow: 379, blue: 346, red: 264 } },
    ],
  },
  {
    id: "academy",
    name: "Academy",
    club: "Golf Club Minsk",
    address: "Kalodishchi, Minsk District, Belarus",
    website: "https://golfminsk.com",
    phone: "+375 (44) 700-22-77",
    tees: [
      { color: "yellow", label: "Yellow", cssColor: "#f59e0b", rating: 55.3, slope: 83, totalMeters: 859 },
      { color: "red",    label: "Red",    cssColor: "#ef4444", rating: 53.0, slope: 78, totalMeters: 696 },
    ],
    totalPar: 27,
    holes: [
      { number: 1, par: 3, hcp: 7, meters: { black: 87,  white: 87,  yellow: 87,  blue: 87,  red: 70 } },
      { number: 2, par: 3, hcp: 4, meters: { black: 96,  white: 96,  yellow: 96,  blue: 96,  red: 81 } },
      { number: 3, par: 3, hcp: 9, meters: { black: 80,  white: 80,  yellow: 80,  blue: 80,  red: 61 } },
      { number: 4, par: 3, hcp: 3, meters: { black: 98,  white: 98,  yellow: 98,  blue: 98,  red: 80 } },
      { number: 5, par: 3, hcp: 6, meters: { black: 89,  white: 89,  yellow: 89,  blue: 89,  red: 69 } },
      { number: 6, par: 3, hcp: 8, meters: { black: 87,  white: 87,  yellow: 87,  blue: 87,  red: 70 } },
      { number: 7, par: 3, hcp: 2, meters: { black: 105, white: 105, yellow: 105, blue: 105, red: 84 } },
      { number: 8, par: 3, hcp: 5, meters: { black: 91,  white: 91,  yellow: 91,  blue: 91,  red: 71 } },
      { number: 9, par: 3, hcp: 1, meters: { black: 126, white: 126, yellow: 126, blue: 126, red: 110 } },
    ],
  },

  // ── Russia ────────────────────────────────────────────────────────────────

  {
    id: "pestovo",
    name: "Pestovo",
    club: "Pestovo Golf & Country Club",
    address: "Dmitrovsky District, Moscow Oblast, Russia",
    website: "https://www.pestovogolf.ru",
    phone: "+7 (495) 988-43-00",
    designer: "Kyle Phillips",
    tees: [
      { color: "black",  label: "Black",  cssColor: "#1f2937", rating: 74.5, slope: 136, totalMeters: 6745 },
      { color: "white",  label: "White",  cssColor: "#f8fafc", rating: 72.5, slope: 130, totalMeters: 6430 },
      { color: "yellow", label: "Yellow", cssColor: "#f59e0b", rating: 70.5, slope: 126, totalMeters: 6058 },
      { color: "blue",   label: "Blue",   cssColor: "#3b82f6", rating: 69.0, slope: 123, totalMeters: 5765 },
      { color: "red",    label: "Red",    cssColor: "#ef4444", rating: 67.0, slope: 119, totalMeters: 5275 },
    ],
    totalPar: 72,
    holes: [
      { number: 1,  par: 4, hcp: 1,  meters: { black: 425, white: 405, yellow: 380, blue: 360, red: 330 } },
      { number: 2,  par: 5, hcp: 3,  meters: { black: 530, white: 510, yellow: 485, blue: 465, red: 430 } },
      { number: 3,  par: 3, hcp: 13, meters: { black: 195, white: 185, yellow: 170, blue: 160, red: 145 } },
      { number: 4,  par: 4, hcp: 7,  meters: { black: 395, white: 375, yellow: 355, blue: 340, red: 308 } },
      { number: 5,  par: 4, hcp: 5,  meters: { black: 410, white: 390, yellow: 370, blue: 355, red: 320 } },
      { number: 6,  par: 4, hcp: 11, meters: { black: 370, white: 350, yellow: 330, blue: 315, red: 285 } },
      { number: 7,  par: 3, hcp: 17, meters: { black: 165, white: 155, yellow: 142, blue: 132, red: 120 } },
      { number: 8,  par: 5, hcp: 15, meters: { black: 505, white: 485, yellow: 460, blue: 440, red: 410 } },
      { number: 9,  par: 4, hcp: 9,  meters: { black: 385, white: 365, yellow: 345, blue: 328, red: 298 } },
      { number: 10, par: 4, hcp: 2,  meters: { black: 430, white: 410, yellow: 385, blue: 365, red: 335 } },
      { number: 11, par: 3, hcp: 12, meters: { black: 185, white: 175, yellow: 162, blue: 152, red: 138 } },
      { number: 12, par: 4, hcp: 4,  meters: { black: 415, white: 395, yellow: 370, blue: 352, red: 322 } },
      { number: 13, par: 5, hcp: 8,  meters: { black: 520, white: 500, yellow: 475, blue: 455, red: 420 } },
      { number: 14, par: 4, hcp: 6,  meters: { black: 400, white: 380, yellow: 360, blue: 342, red: 310 } },
      { number: 15, par: 3, hcp: 18, meters: { black: 155, white: 145, yellow: 132, blue: 122, red: 110 } },
      { number: 16, par: 4, hcp: 14, meters: { black: 360, white: 345, yellow: 325, blue: 308, red: 278 } },
      { number: 17, par: 5, hcp: 16, meters: { black: 495, white: 475, yellow: 450, blue: 430, red: 398 } },
      { number: 18, par: 4, hcp: 10, meters: { black: 405, white: 385, yellow: 362, blue: 344, red: 318 } },
    ],
  },

  {
    id: "skolkovo",
    name: "Skolkovo",
    club: "Skolkovo Golf Club",
    address: "Odintsovsky District, Moscow Oblast, Russia",
    website: "https://skolkovogolf.ru",
    phone: "+7 (495) 956-05-53",
    designer: "Jack Nicklaus",
    tees: [
      { color: "black",  label: "Black",  cssColor: "#1f2937", rating: 73.8, slope: 134, totalMeters: 6620 },
      { color: "white",  label: "White",  cssColor: "#f8fafc", rating: 71.8, slope: 128, totalMeters: 6320 },
      { color: "yellow", label: "Yellow", cssColor: "#f59e0b", rating: 69.8, slope: 124, totalMeters: 5950 },
      { color: "blue",   label: "Blue",   cssColor: "#3b82f6", rating: 68.5, slope: 121, totalMeters: 5635 },
      { color: "red",    label: "Red",    cssColor: "#ef4444", rating: 66.5, slope: 116, totalMeters: 5140 },
    ],
    totalPar: 72,
    holes: [
      { number: 1,  par: 5, hcp: 3,  meters: { black: 515, white: 495, yellow: 470, blue: 448, red: 415 } },
      { number: 2,  par: 4, hcp: 7,  meters: { black: 390, white: 372, yellow: 350, blue: 332, red: 302 } },
      { number: 3,  par: 3, hcp: 15, meters: { black: 178, white: 168, yellow: 155, blue: 145, red: 130 } },
      { number: 4,  par: 4, hcp: 1,  meters: { black: 435, white: 415, yellow: 390, blue: 372, red: 338 } },
      { number: 5,  par: 4, hcp: 9,  meters: { black: 375, white: 358, yellow: 336, blue: 318, red: 288 } },
      { number: 6,  par: 4, hcp: 5,  meters: { black: 408, white: 390, yellow: 368, blue: 348, red: 318 } },
      { number: 7,  par: 3, hcp: 17, meters: { black: 162, white: 152, yellow: 140, blue: 130, red: 118 } },
      { number: 8,  par: 4, hcp: 11, meters: { black: 368, white: 350, yellow: 330, blue: 312, red: 282 } },
      { number: 9,  par: 5, hcp: 13, meters: { black: 510, white: 490, yellow: 465, blue: 442, red: 410 } },
      { number: 10, par: 4, hcp: 2,  meters: { black: 425, white: 405, yellow: 382, blue: 362, red: 330 } },
      { number: 11, par: 4, hcp: 8,  meters: { black: 385, white: 368, yellow: 346, blue: 328, red: 298 } },
      { number: 12, par: 3, hcp: 16, meters: { black: 168, white: 158, yellow: 145, blue: 136, red: 122 } },
      { number: 13, par: 5, hcp: 4,  meters: { black: 525, white: 505, yellow: 478, blue: 455, red: 420 } },
      { number: 14, par: 4, hcp: 6,  meters: { black: 398, white: 380, yellow: 358, blue: 340, red: 308 } },
      { number: 15, par: 4, hcp: 10, meters: { black: 372, white: 355, yellow: 334, blue: 315, red: 285 } },
      { number: 16, par: 3, hcp: 18, meters: { black: 158, white: 148, yellow: 136, blue: 126, red: 112 } },
      { number: 17, par: 4, hcp: 14, meters: { black: 362, white: 345, yellow: 324, blue: 306, red: 278 } },
      { number: 18, par: 5, hcp: 12, meters: { black: 486, white: 466, yellow: 443, blue: 420, red: 386 } },
    ],
  },

  {
    id: "petergolf",
    name: "PeterGolf",
    club: "PeterGolf",
    address: "Leningrad Oblast, Russia",
    website: "https://petergolf.ru",
    phone: "+7 (812) 448-20-50",
    tees: [
      { color: "black",  label: "Black",  cssColor: "#1f2937", rating: 73.2, slope: 132, totalMeters: 6676 },
      { color: "white",  label: "White",  cssColor: "#f8fafc", rating: 71.2, slope: 127, totalMeters: 6366 },
      { color: "yellow", label: "Yellow", cssColor: "#f59e0b", rating: 69.5, slope: 123, totalMeters: 5997 },
      { color: "blue",   label: "Blue",   cssColor: "#3b82f6", rating: 68.0, slope: 119, totalMeters: 5682 },
      { color: "red",    label: "Red",    cssColor: "#ef4444", rating: 66.0, slope: 114, totalMeters: 5188 },
    ],
    totalPar: 72,
    holes: [
      { number: 1,  par: 4, hcp: 5,  meters: { black: 398, white: 378, yellow: 356, blue: 338, red: 308 } },
      { number: 2,  par: 5, hcp: 1,  meters: { black: 535, white: 515, yellow: 488, blue: 465, red: 432 } },
      { number: 3,  par: 4, hcp: 11, meters: { black: 372, white: 354, yellow: 334, blue: 316, red: 286 } },
      { number: 4,  par: 3, hcp: 15, meters: { black: 182, white: 172, yellow: 158, blue: 148, red: 134 } },
      { number: 5,  par: 4, hcp: 3,  meters: { black: 420, white: 400, yellow: 378, blue: 358, red: 326 } },
      { number: 6,  par: 4, hcp: 9,  meters: { black: 376, white: 358, yellow: 337, blue: 320, red: 290 } },
      { number: 7,  par: 5, hcp: 7,  meters: { black: 510, white: 490, yellow: 464, blue: 442, red: 408 } },
      { number: 8,  par: 3, hcp: 17, meters: { black: 168, white: 158, yellow: 145, blue: 136, red: 122 } },
      { number: 9,  par: 4, hcp: 13, meters: { black: 362, white: 344, yellow: 324, blue: 306, red: 278 } },
      { number: 10, par: 4, hcp: 4,  meters: { black: 412, white: 392, yellow: 370, blue: 350, red: 320 } },
      { number: 11, par: 3, hcp: 16, meters: { black: 172, white: 162, yellow: 150, blue: 140, red: 126 } },
      { number: 12, par: 5, hcp: 2,  meters: { black: 528, white: 508, yellow: 482, blue: 458, red: 424 } },
      { number: 13, par: 4, hcp: 6,  meters: { black: 405, white: 385, yellow: 362, blue: 344, red: 312 } },
      { number: 14, par: 4, hcp: 8,  meters: { black: 388, white: 370, yellow: 348, blue: 330, red: 300 } },
      { number: 15, par: 3, hcp: 14, meters: { black: 176, white: 166, yellow: 153, blue: 143, red: 128 } },
      { number: 16, par: 4, hcp: 10, meters: { black: 368, white: 350, yellow: 330, blue: 312, red: 282 } },
      { number: 17, par: 5, hcp: 18, meters: { black: 488, white: 468, yellow: 444, blue: 422, red: 390 } },
      { number: 18, par: 4, hcp: 12, meters: { black: 416, white: 396, yellow: 374, blue: 354, red: 322 } },
    ],
  },

  {
    id: "mcc-nakhabino",
    name: "Nakhabino",
    club: "Moscow Country Club",
    address: "Nakhabino, Krasnogorsk, Moscow Oblast, Russia",
    website: "https://www.moscow-country-club.ru",
    phone: "+7 (495) 626-59-11",
    designer: "Robert Trent Jones Jr.",
    tees: [
      { color: "black",  label: "Black",  cssColor: "#1f2937", rating: 72.8, slope: 130, totalMeters: 6690 },
      { color: "white",  label: "White",  cssColor: "#f8fafc", rating: 71.0, slope: 125, totalMeters: 6271 },
      { color: "yellow", label: "Yellow", cssColor: "#f59e0b", rating: 69.2, slope: 121, totalMeters: 5966 },
      { color: "blue",   label: "Blue",   cssColor: "#3b82f6", rating: 67.8, slope: 117, totalMeters: 5634 },
      { color: "red",    label: "Red",    cssColor: "#ef4444", rating: 65.8, slope: 112, totalMeters: 5110 },
    ],
    totalPar: 72,
    holes: [
      { number: 1,  par: 4, hcp: 9,  meters: { black: 378, white: 360, yellow: 340, blue: 322, red: 292 } },
      { number: 2,  par: 4, hcp: 3,  meters: { black: 420, white: 400, yellow: 378, blue: 358, red: 326 } },
      { number: 3,  par: 3, hcp: 15, meters: { black: 175, white: 165, yellow: 152, blue: 142, red: 128 } },
      { number: 4,  par: 5, hcp: 1,  meters: { black: 530, white: 510, yellow: 484, blue: 460, red: 425 } },
      { number: 5,  par: 4, hcp: 7,  meters: { black: 395, white: 376, yellow: 355, blue: 336, red: 306 } },
      { number: 6,  par: 4, hcp: 5,  meters: { black: 408, white: 390, yellow: 367, blue: 348, red: 316 } },
      { number: 7,  par: 3, hcp: 17, meters: { black: 160, white: 150, yellow: 138, blue: 128, red: 115 } },
      { number: 8,  par: 5, hcp: 11, meters: { black: 500, white: 480, yellow: 455, blue: 432, red: 400 } },
      { number: 9,  par: 4, hcp: 13, meters: { black: 358, white: 340, yellow: 320, blue: 303, red: 275 } },
      { number: 10, par: 4, hcp: 2,  meters: { black: 428, white: 408, yellow: 385, blue: 365, red: 332 } },
      { number: 11, par: 5, hcp: 4,  meters: { black: 518, white: 498, yellow: 472, blue: 448, red: 415 } },
      { number: 12, par: 3, hcp: 16, meters: { black: 165, white: 155, yellow: 143, blue: 133, red: 120 } },
      { number: 13, par: 4, hcp: 8,  meters: { black: 390, white: 372, yellow: 350, blue: 332, red: 302 } },
      { number: 14, par: 4, hcp: 6,  meters: { black: 402, white: 383, yellow: 360, blue: 342, red: 310 } },
      { number: 15, par: 3, hcp: 18, meters: { black: 152, white: 142, yellow: 130, blue: 120, red: 108 } },
      { number: 16, par: 4, hcp: 12, meters: { black: 368, white: 350, yellow: 330, blue: 313, red: 282 } },
      { number: 17, par: 5, hcp: 10, meters: { black: 495, white: 475, yellow: 450, blue: 428, red: 396 } },
      { number: 18, par: 4, hcp: 14, meters: { black: 448, white: 317, yellow: 357, blue: 324, red: 262 } },
    ],
  },

  {
    id: "agalarov",
    name: "Agalarov",
    club: "Agalarov Golf & Country Club",
    address: "Krasnogorsk, Moscow Oblast, Russia",
    website: "https://agalarovgolf.ru",
    phone: "+7 (495) 287-29-51",
    tees: [
      { color: "black",  label: "Black",  cssColor: "#1f2937", rating: 74.2, slope: 135, totalMeters: 6695 },
      { color: "white",  label: "White",  cssColor: "#f8fafc", rating: 72.0, slope: 129, totalMeters: 6383 },
      { color: "yellow", label: "Yellow", cssColor: "#f59e0b", rating: 70.2, slope: 125, totalMeters: 6011 },
      { color: "blue",   label: "Blue",   cssColor: "#3b82f6", rating: 68.8, slope: 121, totalMeters: 5695 },
      { color: "red",    label: "Red",    cssColor: "#ef4444", rating: 66.8, slope: 116, totalMeters: 5203 },
    ],
    totalPar: 72,
    holes: [
      { number: 1,  par: 5, hcp: 5,  meters: { black: 512, white: 490, yellow: 464, blue: 442, red: 408 } },
      { number: 2,  par: 4, hcp: 1,  meters: { black: 438, white: 418, yellow: 394, blue: 374, red: 340 } },
      { number: 3,  par: 3, hcp: 13, meters: { black: 192, white: 182, yellow: 167, blue: 157, red: 142 } },
      { number: 4,  par: 4, hcp: 9,  meters: { black: 378, white: 360, yellow: 340, blue: 322, red: 292 } },
      { number: 5,  par: 4, hcp: 3,  meters: { black: 425, white: 405, yellow: 382, blue: 362, red: 330 } },
      { number: 6,  par: 5, hcp: 7,  meters: { black: 520, white: 500, yellow: 474, blue: 450, red: 418 } },
      { number: 7,  par: 3, hcp: 17, meters: { black: 163, white: 153, yellow: 140, blue: 130, red: 118 } },
      { number: 8,  par: 4, hcp: 11, meters: { black: 372, white: 354, yellow: 334, blue: 317, red: 287 } },
      { number: 9,  par: 4, hcp: 15, meters: { black: 355, white: 338, yellow: 318, blue: 302, red: 274 } },
      { number: 10, par: 4, hcp: 2,  meters: { black: 432, white: 412, yellow: 388, blue: 368, red: 336 } },
      { number: 11, par: 4, hcp: 4,  meters: { black: 418, white: 398, yellow: 376, blue: 356, red: 324 } },
      { number: 12, par: 5, hcp: 6,  meters: { black: 525, white: 505, yellow: 478, blue: 455, red: 420 } },
      { number: 13, par: 3, hcp: 16, meters: { black: 170, white: 160, yellow: 147, blue: 137, red: 124 } },
      { number: 14, par: 4, hcp: 8,  meters: { black: 398, white: 378, yellow: 356, blue: 338, red: 308 } },
      { number: 15, par: 4, hcp: 10, meters: { black: 382, white: 364, yellow: 343, blue: 325, red: 295 } },
      { number: 16, par: 3, hcp: 18, meters: { black: 158, white: 148, yellow: 136, blue: 126, red: 113 } },
      { number: 17, par: 5, hcp: 12, meters: { black: 498, white: 478, yellow: 453, blue: 430, red: 398 } },
      { number: 18, par: 4, hcp: 14, meters: { black: 359, white: 340, yellow: 321, blue: 304, red: 276 } },
    ],
  },

  {
    id: "tseleevo",
    name: "Tseleevo",
    club: "Tseleevo Golf & Polo Club",
    address: "Klin District, Moscow Oblast, Russia",
    website: "https://tseleevo.ru",
    phone: "+7 (495) 995-07-07",
    designer: "Robert Trent Jones Jr.",
    tees: [
      { color: "black",  label: "Black",  cssColor: "#1f2937", rating: 73.5, slope: 133, totalMeters: 6610 },
      { color: "white",  label: "White",  cssColor: "#f8fafc", rating: 71.5, slope: 128, totalMeters: 6391 },
      { color: "yellow", label: "Yellow", cssColor: "#f59e0b", rating: 69.8, slope: 124, totalMeters: 5971 },
      { color: "blue",   label: "Blue",   cssColor: "#3b82f6", rating: 68.2, slope: 120, totalMeters: 5660 },
      { color: "red",    label: "Red",    cssColor: "#ef4444", rating: 66.2, slope: 115, totalMeters: 5175 },
    ],
    totalPar: 72,
    holes: [
      { number: 1,  par: 4, hcp: 7,  meters: { black: 392, white: 373, yellow: 352, blue: 334, red: 303 } },
      { number: 2,  par: 4, hcp: 3,  meters: { black: 422, white: 402, yellow: 380, blue: 360, red: 328 } },
      { number: 3,  par: 5, hcp: 9,  meters: { black: 508, white: 488, yellow: 462, blue: 440, red: 407 } },
      { number: 4,  par: 3, hcp: 15, meters: { black: 178, white: 168, yellow: 154, blue: 145, red: 130 } },
      { number: 5,  par: 4, hcp: 1,  meters: { black: 435, white: 415, yellow: 392, blue: 372, red: 338 } },
      { number: 6,  par: 4, hcp: 11, meters: { black: 368, white: 350, yellow: 330, blue: 313, red: 283 } },
      { number: 7,  par: 3, hcp: 17, meters: { black: 162, white: 152, yellow: 140, blue: 130, red: 117 } },
      { number: 8,  par: 5, hcp: 5,  meters: { black: 522, white: 502, yellow: 476, blue: 452, red: 418 } },
      { number: 9,  par: 4, hcp: 13, meters: { black: 368, white: 350, yellow: 330, blue: 314, red: 284 } },
      { number: 10, par: 5, hcp: 2,  meters: { black: 532, white: 512, yellow: 485, blue: 460, red: 426 } },
      { number: 11, par: 4, hcp: 4,  meters: { black: 415, white: 395, yellow: 373, blue: 354, red: 322 } },
      { number: 12, par: 3, hcp: 16, meters: { black: 168, white: 158, yellow: 145, blue: 136, red: 122 } },
      { number: 13, par: 4, hcp: 6,  meters: { black: 405, white: 385, yellow: 363, blue: 345, red: 313 } },
      { number: 14, par: 4, hcp: 8,  meters: { black: 385, white: 368, yellow: 346, blue: 328, red: 298 } },
      { number: 15, par: 3, hcp: 18, meters: { black: 155, white: 145, yellow: 133, blue: 123, red: 110 } },
      { number: 16, par: 4, hcp: 14, meters: { black: 360, white: 343, yellow: 323, blue: 306, red: 277 } },
      { number: 17, par: 5, hcp: 10, meters: { black: 492, white: 472, yellow: 448, blue: 425, red: 393 } },
      { number: 18, par: 4, hcp: 12, meters: { black: 343, white: 413, yellow: 339, blue: 323, red: 306 } },
    ],
  },
];

// ── Custom courses (AI-generated, stored in localStorage) ─────────────────

const CUSTOM_COURSES_KEY = "golf_custom_courses";

export function getCustomCourses(): Course[] {
  try {
    const raw = localStorage.getItem(CUSTOM_COURSES_KEY);
    return raw ? (JSON.parse(raw) as Course[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomCourse(course: Course): void {
  try {
    const existing = getCustomCourses().filter((c) => c.id !== course.id);
    localStorage.setItem(CUSTOM_COURSES_KEY, JSON.stringify([course, ...existing].slice(0, 30)));
  } catch {
    // ignore storage errors
  }
}

export function deleteCustomCourse(id: string): void {
  try {
    const courses = getCustomCourses().filter((c) => c.id !== id);
    localStorage.setItem(CUSTOM_COURSES_KEY, JSON.stringify(courses));
  } catch {
    // ignore
  }
}

export function getAllCourses(): Course[] {
  return [...COURSES, ...getCustomCourses()];
}
