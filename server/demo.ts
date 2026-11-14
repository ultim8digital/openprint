import { randomBytes, randomUUID } from 'node:crypto';
import type { Store } from './database.js';
import { hashPassword } from './security.js';
import { sendOffer } from './domain.js';
import type { User } from '../shared/types.js';

/** Entirely fictional, explicit opt-in; never import production directory data. */
export async function seedDemo(store: Store) {
  if (store.get("SELECT 1 FROM meta WHERE key='demo'")) return;
  if (store.get('SELECT 1 FROM users LIMIT 1'))
    throw new Error(
      'Refusing to seed demo data into an existing community. Choose an empty DATA_DIR.',
    );
  const hash = await hashPassword(randomBytes(48).toString('hex'));
  const now = Date.now();
  const accounts = [
    ['Аня · заказчик', 'customer'],
    ['Layer Lab · мастерская', 'studio'],
    ['Алексей · инженер', 'engineer'],
    ['Модератор сообщества', 'admin'],
    ['Forma Works', 'forma'],
    ['Melt Collective', 'melt'],
    ['Nylon Studio', 'nylon'],
    ['Kite Engineering', 'kite'],
  ];
  const users: Record<string, User> = {};
  store.transaction(() => {
    for (const [name, slug] of accounts) {
      const user: User = {
        id: randomUUID(),
        name,
        email: `${slug}@demo.example`,
        role: slug === 'admin' ? 'admin' : 'member',
      };
      users[slug] = user;
      store.run(
        'INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
        user.id,
        user.email,
        name,
        hash,
        user.role,
        now,
      );
    }
    const profiles = [
      {
        user: 'studio',
        name: 'Layer Lab',
        kind: 'studio',
        city: 'Москва',
        desc: 'Небольшая мастерская точных деталей. Печатаем прототипы, корпуса и малые серии. Помогаем выбрать материал и ориентацию слоёв.',
        tech: ['FDM', 'SLA'],
        mat: ['PLA', 'PETG', 'Resin'],
        lat: 55.7558,
        lng: 37.6173,
        remote: 1,
        verified: 1,
      },
      {
        user: 'engineer',
        name: 'Алексей · CAD & Repair',
        kind: 'engineer',
        city: 'Санкт-Петербург',
        desc: 'Превращаю эскизы и сломанные детали в рабочие 3D-модели. Параметрическое проектирование, обратный инжиниринг, подготовка к печати.',
        tech: ['CAD'],
        mat: ['Any'],
        lat: 59.9343,
        lng: 30.3351,
        remote: 1,
        verified: 1,
      },
      {
        user: 'forma',
        name: 'Forma Works',
        kind: 'both',
        city: 'Казань',
        desc: 'От первого эскиза до проверенного прототипа. Делаем предметы для дома, функциональные крепления и детали для небольших производств.',
        tech: ['FDM', 'CAD'],
        mat: ['PLA', 'PETG', 'TPU'],
        lat: 55.7963,
        lng: 49.1088,
        remote: 0,
        verified: 0,
      },
      {
        user: 'melt',
        name: 'Melt Collective',
        kind: 'studio',
        city: 'Тбилиси',
        desc: 'Открытая мастерская для дизайнеров и маленьких брендов. Предметный дизайн, аккуратная фотополимерная печать и финишная обработка.',
        tech: ['SLA', 'FDM'],
        mat: ['Resin', 'PLA'],
        lat: 41.7151,
        lng: 44.8271,
        remote: 1,
        verified: 0,
      },
      {
        user: 'nylon',
        name: 'Nylon Studio',
        kind: 'studio',
        city: 'Бангкок',
        desc: 'Износостойкие детали и небольшие серии из нейлона. Обсудим допуски, нагрузки и требования к поверхности до начала производства.',
        tech: ['SLS', 'FDM'],
        mat: ['Nylon', 'PETG'],
        lat: 13.7563,
        lng: 100.5018,
        remote: 1,
        verified: 0,
      },
      {
        user: 'kite',
        name: 'Kite Engineering',
        kind: 'engineer',
        city: 'Алматы',
        desc: 'Проектируем оснастку, держатели и прототипы механизмов. Проверяем сборку и передаём исходники вместе с файлами для изготовления.',
        tech: ['CAD', 'CNC'],
        mat: ['Metal', 'PLA'],
        lat: 43.222,
        lng: 76.8512,
        remote: 1,
        verified: 0,
      },
    ];
    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i];
      store.run(
        'INSERT INTO profiles(id,user_id,name,kind,city,description,technologies,materials,lat,lng,remote,verified,demo,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,?)',
        randomUUID(),
        users[p.user].id,
        p.name,
        p.kind,
        p.city,
        p.desc,
        JSON.stringify(p.tech),
        JSON.stringify(p.mat),
        p.lat,
        p.lng,
        p.remote,
        p.verified,
        now - i * 1000,
      );
    }
    const projects = [
      {
        title: 'Корпус для домашней метеостанции',
        description:
          'Нужен аккуратный корпус под плату 65 × 45 мм и датчик температуры. Габариты около 90 × 60 × 30 мм. Установка в помещении, крепление на два винта. Хочу обсудить вентиляционные отверстия и доступ к USB.',
        kind: 'print',
        city: 'Москва',
        tech: 'FDM',
        material: 'PETG',
        quantity: 3,
        budget: 450000,
      },
      {
        title: 'Восстановить ручку кофемолки',
        description:
          'Сломалась пластиковая ручка ручной кофемолки. Есть образец и размеры посадочного места. Нужны модель, рекомендации по материалу и изготовление двух деталей. Деталь не контактирует с продуктами.',
        kind: 'repair',
        city: 'Санкт-Петербург',
        tech: 'Any',
        material: 'Any',
        quantity: 2,
        budget: 300000,
      },
      {
        title: 'Спроектировать модульный органайзер',
        description:
          'Ищу инженера для модели настольного органайзера из трёх модулей. Важны пазовое соединение, возможность изменить размеры и исходник в открытом формате. Общая ширина 240 мм, глубина 120 мм.',
        kind: 'design',
        city: 'Удалённо',
        tech: 'CAD',
        material: 'Any',
        quantity: 1,
        budget: 800000,
      },
      {
        title: 'Напечатать держатели для растений',
        description:
          'Шесть небольших держателей для кашпо диаметром 12 см. Нужны устойчивость к влаге и возможность закрепить на перилах толщиной 35 мм. Исполнитель поможет уточнить безопасную конструкцию.',
        kind: 'print',
        city: 'Казань',
        tech: 'FDM',
        material: 'PETG',
        quantity: 6,
        budget: null,
      },
    ];
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      store.run(
        "INSERT INTO jobs(id,owner_id,title,description,kind,city,technology,material,quantity,currency,budget,visibility,demo,created_at) VALUES(?,?,?,?,?,?,?,?,?,'RUB',?,'public',1,?)",
        randomUUID(),
        users.customer.id,
        p.title,
        p.description,
        p.kind,
        p.city,
        p.tech,
        p.material,
        p.quantity,
        p.budget,
        now - i * 3600000,
      );
    }
    const presets = [
      [
        'Калибровочный куб',
        'Простой куб 20 × 20 × 20 мм. Начните с проверки размеров и качества стенок на своём принтере.',
        'tools',
        { kind: 'block', width: 20, depth: 20, height: 20, hole: 0 },
      ],
      [
        'Крепёжная пластина',
        'Прямоугольная пластина с центральным отверстием. Размеры и диаметр можно изменить в конструкторе.',
        'parts',
        { kind: 'plate', width: 60, depth: 35, height: 5, hole: 8 },
      ],
      [
        'Дистанционная втулка',
        'Полая втулка для макетов и неответственных креплений. Подберите диаметр отверстия и высоту под свой проект.',
        'parts',
        { kind: 'tube', width: 24, depth: 24, height: 20, hole: 12 },
      ],
    ];
    for (let i = 0; i < presets.length; i++) {
      const [title, description, category, preset] = presets[i];
      store.run(
        "INSERT INTO models(id,owner_id,title,description,category,license,attribution,preset,published,demo,created_at) VALUES(?,?,?,?,?,'CC0-1.0','OpenPrint contributors',?,1,1,?)",
        randomUUID(),
        users.admin.id,
        String(title),
        String(description),
        String(category),
        JSON.stringify(preset),
        now - i * 1000,
      );
    }
    store.run("INSERT INTO meta(key,value) VALUES('demo','1')");
  });
  const first = store.get<{ id: string }>(
    "SELECT id FROM jobs WHERE title='Корпус для домашней метеостанции'",
  )!;
  sendOffer(store, users.studio, first.id, {
    price: 390000,
    days: 4,
    note: 'PETG, слой 0,2 мм. Проверим зазоры крышки на тестовом фрагменте. В стоимость включены три корпуса без доставки.',
  });
  sendOffer(store, users.forma, first.id, {
    price: 420000,
    days: 3,
    note: 'Подготовим модель к печати и изготовим три комплекта. Перед запуском согласуем цвет и расположение отверстий.',
  });
}
