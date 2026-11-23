export interface CategorySeed { name: string; slug: string; description: string; palette: [string, string][]; books: [string, string, number][] } // [title, author, basePrice]

export const PUBLISHERS = [
  ['ABC Publishers', 'Independent house focused on practical non-fiction and self-development.'],
  ['Penguin Random House India', 'One of the largest trade publishers in India.'],
  ['HarperCollins India', 'Bestselling fiction, memoir and children\'s literature.'],
  ['Westland Books', 'Contemporary Indian and international fiction.'],
  ['Aleph Book Company', 'Serious non-fiction, history and biography.'],
  ['Hachette India', 'Thrillers, romance and young adult favourites.'],
  ['Scholastic India', 'Children\'s books and young adult reads.'],
  ['Rupa Publications', 'Mythology, business and popular science.'],
  ['Oxford University Press', 'Academic and reference titles across disciplines.'],
  ['Manjul Publishing', 'Self-help, wellness and spirituality.'],
] as const;

const P = {
  blue: ['#1d4ed8', '#0b1d4d'], teal: ['#0f766e', '#042f2e'], red: ['#dc2626', '#4c0519'], gold: ['#facc15', '#a16207'],
  night: ['#1e3a5f', '#07101f'], dusk: ['#c2410c', '#312e81'], green: ['#15803d', '#052e16'], plum: ['#7e22ce', '#2e1065'],
  orange: ['#f97316', '#9a3412'], slate: ['#475569', '#0f172a'], rose: ['#e11d48', '#4a044e'], sky: ['#0284c7', '#0c4a6e'],
} as const;
const pal = (...k: (keyof typeof P)[]) => k.map((x) => [...P[x]] as [string, string]);

export const CATEGORIES: CategorySeed[] = [
  { name: 'Romance', slug: 'romance', description: 'Love stories that stay with you.', palette: pal('dusk', 'rose', 'plum'), books: [
    ['Beneath the Stars', 'Jessica Martin', 499], ['A Summer in Jaipur', 'Meera Kapoor', 349], ['Letters Never Sent', 'Olivia Hart', 299], ['The Monsoon Promise', 'Anaya Sen', 329], ['Coffee at Midnight', 'Rhea Dsouza', 279], ['Where the Heart Stays', 'Jessica Martin', 399]] },
  { name: 'Mystery', slug: 'mystery', description: 'Whodunits, thrillers and slow-burn suspense.', palette: pal('night', 'slate', 'teal'), books: [
    ['The Midnight Hour', 'James Adams', 299], ['The Vanishing House', 'Clara Nelson', 99], ['Silent Witness', 'Vikram Rao', 349], ['The Last Train to Kolkata', 'Ishaan Bose', 319], ['Shadows on Marine Drive', 'Vikram Rao', 289], ['The Locked Archive', 'Clara Nelson', 359]] },
  { name: 'Science Fiction', slug: 'science-fiction', description: 'Futures, aliens and big ideas.', palette: pal('sky', 'blue', 'plum'), books: [
    ['The Final Frontier', 'Laura Mitchell', 359], ['Orbit of Silence', 'Arjun Menon', 399], ['Neon Delhi 2150', 'Kabir Anand', 449], ['The Quantum Garden', 'Laura Mitchell', 379], ['Last Signal from Titan', 'Arjun Menon', 429], ['Terraform', 'Dr. Sana Iqbal', 349]] },
  { name: 'Fantasy', slug: 'fantasy', description: 'Magic, dragons and epic quests.', palette: pal('plum', 'green', 'dusk'), books: [
    ['The Dragon of Nilgiri', 'Aditi Varma', 449], ['Crown of Embers', 'Rohan Das', 499], ['The Clockwork Forest', 'Aditi Varma', 399], ['Tales of the Silver Realm', 'Rohan Das', 429], ['The Witch of Hampi', 'Nisha Pillai', 379], ['Sword of the Seventh Moon', 'Rohan Das', 459]] },
  { name: 'Historical', slug: 'historical', description: 'The past, brought vividly to life.', palette: pal('gold', 'dusk', 'slate'), books: [
    ['The Last Mughal Garden', 'Farah Khan', 399], ['Empire of Salt', 'Dr. R. K. Narayanan', 449], ['Letters from 1947', 'Farah Khan', 379], ['The Spice Route', 'Thomas George', 429], ['Chola Tides', 'Dr. R. K. Narayanan', 469], ['Queen of Jhansi', 'Priya Joshi', 349]] },
  { name: 'Biography', slug: 'biography', description: 'Remarkable lives, closely told.', palette: pal('blue', 'slate', 'teal'), books: [
    ['The Man Who Taught India to Dream', 'Dr. R. K. Narayanan', 499], ['Rocket Boy', 'Suresh Menon', 379], ['A Life in Cricket', 'Rahul Verma', 449], ['The Scientist and the Saint', 'Priya Joshi', 399], ['Steel and Silk', 'Farah Khan', 429], ['Voices of a Nation', 'Thomas George', 459]] },
  { name: 'Self-help', slug: 'self-help', description: 'Practical guides to growth, focus and habits.', palette: pal('gold', 'red', 'teal', 'orange'), books: [
    ['The Art of Focus', 'Arjun Patel', 399], ['The Art of Learning', 'Raj Patel', 259], ['The Path to Success', 'James Wright', 359], ['The Joy of Minimalism', 'Daniel Reed', 149], ['Atomic Mornings', 'Daniel Reed', 299], ['Deep Calm', 'Arjun Patel', 329]] },
  { name: 'Memoir', slug: 'memoir', description: 'True stories in the author\'s own voice.', palette: pal('rose', 'dusk', 'night'), books: [
    ['Chai and Chaos', 'Neha Gupta', 349], ['My Mother\'s Kitchen', 'Anaya Sen', 299], ['Leaving Lucknow', 'Imran Qureshi', 369], ['The Long Way Home', 'Olivia Hart', 389], ['Notes from a Small Town', 'Suresh Menon', 279], ['Unfiltered', 'Neha Gupta', 319]] },
  { name: 'Travel', slug: 'travel', description: 'Journeys near and far.', palette: pal('sky', 'teal', 'green'), books: [
    ['Roads of Ladakh', 'Karan Malhotra', 449], ['Backwaters and Beyond', 'Meera Kapoor', 379], ['A Fortnight in Japan', 'Olivia Hart', 429], ['The Himalayan Trail', 'Karan Malhotra', 399], ['Street Food Atlas', 'Rhea Dsouza', 459], ['Slow Trains of India', 'Thomas George', 349]] },
  { name: 'Cooking', slug: 'cooking', description: 'Recipes and kitchen wisdom.', palette: pal('orange', 'red', 'gold'), books: [
    ['Everyday Dal', 'Rhea Dsouza', 349], ['The Biryani Book', 'Imran Qureshi', 499], ['Bake It Simple', 'Nisha Pillai', 429], ['Vegetarian Feasts', 'Meera Kapoor', 399], ['Spice Notes', 'Rhea Dsouza', 379], ['15-Minute Dinners', 'Neha Gupta', 299]] },
  { name: 'Children\'s', slug: 'childrens', description: 'Picture books and stories for young readers.', palette: pal('orange', 'sky', 'green'), books: [
    ['The Lost Kitten', 'Emilly Parker', 339], ['Pip the Little Elephant', 'Emilly Parker', 249], ['The Tiger Who Loved Mangoes', 'Nisha Pillai', 279], ['Moonlight Lullabies', 'Olivia Hart', 229], ['Bunty and the Big Rain', 'Emilly Parker', 259], ['ABC of Animals', 'Scholastic Editors', 199]] },
  { name: 'Young Adult', slug: 'young-adult', description: 'Coming-of-age stories for teens and beyond.', palette: pal('rose', 'blue', 'plum'), books: [
    ['Fifteen Summers', 'Tanvi Shah', 299], ['The Boy Who Hacked the Moon', 'Kabir Anand', 349], ['Notes in the Margin', 'Tanvi Shah', 279], ['Class of 2030', 'Ishaan Bose', 319], ['Rooftop Stars', 'Anaya Sen', 289], ['The Quiet Rebel', 'Tanvi Shah', 309]] },
  { name: 'Comics & Graphic Novels', slug: 'comics-graphic-novels', description: 'Illustrated stories and visual storytelling.', palette: pal('red', 'gold', 'plum'), books: [
    ['Captain Kaveri', 'Kabir Anand', 399], ['Ink & Iron', 'Rohan Das', 449], ['City of Paper', 'Anaya Sen', 429], ['The Little Samurai', 'Karan Malhotra', 349], ['Night Shift Heroes', 'Ishaan Bose', 379], ['Mythic Streets', 'Aditi Varma', 459]] },
  { name: 'Poetry', slug: 'poetry', description: 'Verse, ghazals and lyrical voices.', palette: pal('plum', 'night', 'rose'), books: [
    ['Rain on Tin Roofs', 'Meera Kapoor', 249], ['Ghazals for Tomorrow', 'Imran Qureshi', 299], ['The Unsaid', 'Olivia Hart', 229], ['Salt and Saffron', 'Anaya Sen', 259], ['Small Hours', 'Tanvi Shah', 239], ['Collected Verses', 'Imran Qureshi', 399]] },
  { name: 'Drama', slug: 'drama', description: 'Plays and powerful dramatic works.', palette: pal('red', 'slate', 'dusk'), books: [
    ['The Last Curtain', 'Vikram Rao', 299], ['Five Acts of Delhi', 'Farah Khan', 329], ['Stage Fright', 'Thomas George', 279], ['The Understudy', 'Neha Gupta', 289], ['Voices Behind the Wings', 'Olivia Hart', 309], ['Monologues of Mumbai', 'Vikram Rao', 349]] },
  { name: 'Science', slug: 'science', description: 'Understanding the universe, from atoms to galaxies.', palette: pal('sky', 'green', 'blue'), books: [
    ['Cosmos in a Cup', 'Dr. Sana Iqbal', 429], ['The Curious Cell', 'Dr. Sana Iqbal', 399], ['Mathematics of Everyday Life', 'Dr. R. K. Narayanan', 379], ['Climate: A Short Guide', 'Suresh Menon', 349], ['The Brain Explained', 'Dr. Sana Iqbal', 459], ['Physics for the Curious', 'Rahul Verma', 419]] },
  { name: 'Philosophy', slug: 'philosophy', description: 'Big questions, carefully considered.', palette: pal('slate', 'night', 'gold'), books: [
    ['Meditations for Modern Life', 'Prof. Anil Kumar', 349], ['The Examined Mind', 'Prof. Anil Kumar', 399], ['Ethics in the Age of AI', 'Dr. Sana Iqbal', 429], ['The Stoic Commuter', 'Daniel Reed', 299], ['What Is a Good Life?', 'Prof. Anil Kumar', 379], ['Eastern Thought, Simply', 'Priya Joshi', 359]] },
  { name: 'Religion', slug: 'religion', description: 'Faith, scripture and spiritual traditions.', palette: pal('gold', 'dusk', 'teal'), books: [
    ['The Gita for Everyone', 'Prof. Anil Kumar', 299], ['Stories from the Upanishads', 'Priya Joshi', 329], ['Journey through the Sufi Path', 'Imran Qureshi', 349], ['A Pilgrim\'s Notebook', 'Karan Malhotra', 319], ['The Buddha\'s Walk', 'Priya Joshi', 339], ['Many Paths, One Light', 'Prof. Anil Kumar', 369]] },
  { name: 'Language Learning', slug: 'language-learning', description: 'Learn a new language the practical way.', palette: pal('blue', 'teal', 'orange'), books: [
    ['Spoken English in 30 Days', 'Nisha Pillai', 249], ['Learn Hindi Script', 'Thomas George', 229], ['French for Travellers', 'Olivia Hart', 299], ['Tamil Made Easy', 'Suresh Menon', 239], ['Japanese Phrasebook', 'Karan Malhotra', 269], ['Business English Essentials', 'Rahul Verma', 279]] },
];

export const AUTHOR_BIOS: Record<string, string> = {
  'Daniel Reed': 'Daniel Reed is a writer, minimalist and productivity coach based in San Francisco. His books help readers simplify life one habit at a time.',
  'Arjun Patel': 'Arjun Patel writes about attention, deep work and sustainable productivity for busy professionals.',
};

export const HEADLINES: Record<string, string[]> = {
  default: ['A compelling read from start to finish.', 'Thoughtful, warm and impossible to put down.', 'A fresh voice with a story worth telling.'],
};

export function describe(title: string, author: string, category: string, i: number): string {
  const lead: Record<string, string[]> = {
    'Romance': ['A heartwarming tale where two souls discover who they really are.', 'An aching, hopeful love story set against the rhythm of everyday life.'],
    'Mystery': ['A chilling mystery unfolds within a world where nothing is what it seems.', 'A tightly plotted thriller with a twist you will not see coming.'],
    'Science Fiction': ['A mission to the edge of the unknown puts humanity\'s future at stake.', 'Bold ideas and human stakes collide in this inventive science fiction novel.'],
    'Fantasy': ['An epic adventure of magic, courage and impossible choices.', 'A richly imagined world where old legends are waking up.'],
    'Historical': ['History comes alive through intimate, richly researched storytelling.', 'A sweeping narrative of ambition, loss and resilience.'],
    'Biography': ['An absorbing portrait of a remarkable life and the times that shaped it.', 'Meticulously researched and beautifully told.'],
    'Self-help': ['A practical guide with clear, proven steps for lasting change.', 'Declutter your life to uncover peace, clarity, and joy.'],
    'Memoir': ['Candid, funny and moving - a life told without filters.', 'A personal journey of belonging, loss and reinvention.'],
    'Travel': ['Vivid dispatches and practical wisdom from the road.', 'Pack your bags: this book is a passport to unforgettable places.'],
    'Cooking': ['Approachable recipes, honest technique and flavours you will return to again and again.', 'Everyday cooking made delicious and stress-free.'],
    'Children\'s': ['A heartwarming tale of courage, friendship, and adventure for young readers.', 'Gentle, funny and beautifully told for bedtime and beyond.'],
    'Young Adult': ['A funny, honest story about growing up, falling out and finding your people.', 'Big feelings, sharp humour and a heroine to root for.'],
    'Comics & Graphic Novels': ['Striking artwork and big-hearted storytelling on every page.', 'A visual feast that rewards rereading.'],
    'Poetry': ['Spare, luminous poems that find wonder in ordinary moments.', 'Verse that lingers long after the last page.'],
    'Drama': ['Sharp dialogue and unforgettable characters make this a gripping dramatic work.', 'A powerful play about power, family and the stories we tell.'],
    'Science': ['Complex science made clear, vivid and fun.', 'A curious guide to the ideas that shape our world.'],
    'Philosophy': ['Timeless questions explored with clarity and humour.', 'Accessible, provocative and deeply practical.'],
    'Religion': ['A thoughtful introduction to faith, stories and ritual.', 'Wisdom from sacred traditions, retold for modern readers.'],
    'Language Learning': ['Build real-world fluency with short lessons, drills and everyday dialogue.', 'A friendly, practical route to speaking with confidence.'],
  };
  const options = lead[category] ?? HEADLINES.default;
  const l = options[i % options.length];
  return `${l} "${title}" by ${author} is a ${category.toLowerCase()} title readers describe as thoughtful, well paced and rewarding. Whether you are picking it up for yourself or as a gift, it delivers insight, emotion and plenty to talk about afterwards.`;
}

export const REVIEW_SNIPPETS: [number, string][] = [
  [5, 'Absolutely loved it - finished in two sittings.'], [5, 'Beautifully written and very engaging. Highly recommended!'],
  [5, 'One of the best books I have read this year.'], [4, 'Great read with a few slow moments in the middle.'],
  [4, 'Solid and enjoyable. Would read more by this author.'], [4, 'Good value for the price and arrived on time.'],
  [3, 'Decent, though it did not fully live up to the hype.'], [5, 'Perfect gift - the recipient adored it.'],
  [4, 'Clear, practical and easy to follow.'], [3, 'Interesting ideas, but the ending felt rushed.'],
  [5, 'Could not put it down. Brilliant characters.'], [2, 'Not for me - too predictable.'],
];

export const COUPONS = [
  { code: 'WELCOME10', description: '10% off your order (max Rs 150)', type: 'percent', value: 10, max: 150, min: 200 },
  { code: 'BOOKS100', description: 'Flat Rs 100 off on orders above Rs 799', type: 'flat', value: 100, max: null, min: 799 },
  { code: 'FREESHIP', description: 'Free shipping on any order', type: 'shipping', value: 0, max: null, min: 0 },
  { code: 'READMORE20', description: '20% off (max Rs 300) on orders above Rs 999', type: 'percent', value: 20, max: 300, min: 999 },
] as const;
