

CREATE DATABASE IF NOT EXISTS mms_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mms_db;


CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  password      VARCHAR(255)  NOT NULL,
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


DELIMITER $$
CREATE TRIGGER before_user_insert
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
  IF NEW.role = 'admin' THEN
    SET @admin_count = (SELECT COUNT(*) FROM users WHERE role = 'admin');
    IF @admin_count >= 2 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Maximum 2 admins allowed';
    END IF;
  END IF;
END$$
DELIMITER ;


CREATE TABLE IF NOT EXISTS products (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150)    NOT NULL,
  description     TEXT,
  image_url       VARCHAR(500),
  price           DECIMAL(12,2)   NOT NULL,
  min_bulk_qty    INT             NOT NULL DEFAULT 10,
  stock_quantity  INT             NOT NULL DEFAULT 0,
  category        VARCHAR(100),
  unit            VARCHAR(50)     DEFAULT 'units',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS orders (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT           NOT NULL,
  total_amount        DECIMAL(14,2) NOT NULL,
  status              ENUM('pending','confirmed','processing','shipped','delivered') DEFAULT 'confirmed',
  payment_method      VARCHAR(50)   DEFAULT 'cod',
  shipping_address    TEXT,
  phone_number        VARCHAR(20),
  confirmation_number VARCHAR(30)   NOT NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);


CREATE TABLE IF NOT EXISTS user_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'general',
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS order_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT           NOT NULL,
  product_id  INT           NOT NULL,
  quantity    INT           NOT NULL,
  unit_price  DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES orders(id)  ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);


INSERT INTO products (name, description, image_url, price, min_bulk_qty, stock_quantity, category, unit) VALUES
('High-Tensile Steel Bolts M12',
 'Grade 8.8 hex head bolts, M12x50mm. Zinc-plated for corrosion resistance. Ideal for structural and heavy-duty industrial assembly.',
 NULL, 2.50, 100, 50000, 'Fasteners', 'pieces'),

('Aluminum Sheet 3mm — 6061-T6',
 'Aircraft-grade 6061-T6 aluminum sheet, 3 mm thickness, 1200×2400 mm panels. Excellent strength-to-weight ratio for enclosures and frames.',
 NULL, 45.00, 20, 8000, 'Sheet Metal', 'sheets'),

('Industrial Copper Wire 10 AWG',
 'Bare copper conductor, 10 AWG, 99.9 % purity, 100 m spool. Suitable for power distribution, grounding, and motor winding.',
 NULL, 38.00, 50, 3000, 'Electrical', 'spools'),

('Hydraulic Cylinder 50 mm Bore',
 'Double-acting hydraulic cylinder, 50 mm bore, 200 mm stroke, rated to 250 bar. Chromed piston rod, steel body. Ideal for presses and lifts.',
 NULL, 320.00, 5, 500, 'Hydraulics', 'units'),

('Deep Groove Ball Bearing 6205-2RS',
 'Sealed deep-groove ball bearing, 25×52×15 mm. Pre-lubricated, both-sides sealed. Suitable for electric motors, pumps, and conveyors.',
 NULL, 4.80, 50, 25000, 'Bearings', 'pieces'),

('Stainless Steel Pipe 2-inch Sch40',
 'Schedule 40, 304-grade stainless steel pipe, 2-inch OD, 6 m lengths. Corrosion-resistant; for chemical, food, and water systems.',
 NULL, 85.00, 10, 2000, 'Piping', 'pieces'),

('Industrial V-Belt B-Section',
 'Classical rubber V-belt, B-section. Oil-resistant EPDM compound. Available in lengths B50 to B120. Fits standard B-groove pulleys.',
 NULL, 12.50, 20, 10000, 'Power Transmission', 'pieces'),

('Solid Carbide End Mill 10 mm 4-Flute',
 'TiAlN-coated solid carbide end mill, 10 mm dia, 4-flute, 22 mm LOC. Suitable for aluminium, stainless steel, and hardened steels.',
 NULL, 28.00, 25, 5000, 'Cutting Tools', 'pieces'),

('Helical Gearbox 3:1 Ratio 15 kW',
 'Inline helical gear reducer, 3:1 ratio, input shaft Ø30 mm, output shaft Ø45 mm, 15 kW rated power. IEC B3/B5 foot/flange mount.',
 NULL, 850.00, 2, 200, 'Power Transmission', 'units'),

('Pneumatic Push-Fit Fitting 1/4 BSP',
 'Brass push-in straight connector, 1/4 BSP male, for 6 mm OD polyurethane tubing. 10 bar max working pressure.',
 NULL, 1.80, 100, 40000, 'Pneumatics', 'pieces'),

('NBR Rubber Gasket 150 mm',
 'Nitrile rubber (NBR) flat gasket, 150 mm OD × 110 mm ID × 3 mm thick. Oil, fuel, and solvent resistant. PN16 flange compatible.',
 NULL, 3.20, 50, 15000, 'Seals & Gaskets', 'pieces'),

('Three-Phase Induction Motor 5.5 kW',
 'IE3 efficiency, 5.5 kW, 4-pole, 1450 RPM at 50 Hz. Foot-mounted (B3), IP55, class F insulation. IEC frame 132S.',
 NULL, 420.00, 2, 150, 'Electric Motors', 'units'),

('Welding Electrode E6013 3.2 mm',
 'Rutile general-purpose electrode, E6013, 3.2 mm × 350 mm, 5 kg box. Suitable for mild steel welding in all positions.',
 NULL, 22.00, 20, 8000, 'Welding', 'boxes'),

('Spring-Loaded Safety Valve 1-inch',
 'Full-lift safety relief valve, 1-inch BSP inlet, stainless trim, set pressure 10 bar. ASME/PED compliant. For steam and air applications.',
 NULL, 95.00, 5, 600, 'Valves', 'units'),

('Industrial Grease NLGI 2 — 18 kg Drum',
 'Lithium-complex extreme-pressure grease, NLGI grade 2. Anti-wear, anti-corrosion additives. Suitable for bearings, gears, and slides.',
 NULL, 65.00, 10, 2000, 'Lubricants', 'drums'),

('Hex Nut M16 Grade 8 HDG',
 'High-strength hex nut, M16, property class 8, hot-dip galvanised for outdoor and structural applications.',
 NULL, 0.95, 200, 80000, 'Fasteners', 'pieces'),

('Hydraulic Filter Cartridge 10 Micron',
 'Absolute-rated glass-fibre filter cartridge, 10 µm, Beta-10 ≥ 200. Replaces Parker 925874, Donaldson P164375. 25 bar differential rating.',
 NULL, 18.00, 25, 4000, 'Filtration', 'pieces'),

('ANSI Roller Chain 1-inch Pitch',
 'ANSI/ASME B29.1 standard roller chain, 1-inch pitch (#80), case-hardened pins and bushings, 10-foot roll. For heavy conveyor drives.',
 NULL, 75.00, 5, 1500, 'Power Transmission', 'rolls');
