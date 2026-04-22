

USE mms_db;


CREATE TABLE IF NOT EXISTS employees (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  emp_code            VARCHAR(20)   NOT NULL UNIQUE,
  name                VARCHAR(100)  NOT NULL,
  department          VARCHAR(100)  NOT NULL,
  designation         VARCHAR(100)  NOT NULL,
  base_salary         DECIMAL(12,2) NOT NULL DEFAULT 15000.00,
  daily_bonus         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  consecutive_present INT           NOT NULL DEFAULT 0,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS attendance (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT  NOT NULL,
  date        DATE NOT NULL,
  status      ENUM('present','absent') NOT NULL,
  marked_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY uq_emp_date (employee_id, date)
);


CREATE TABLE IF NOT EXISTS admin_notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  type       VARCHAR(50)  NOT NULL DEFAULT 'attendance',
  title      VARCHAR(200) NOT NULL,
  message    TEXT         NOT NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


DROP PROCEDURE IF EXISTS seed_employees;

DELIMITER $$
CREATE PROCEDURE seed_employees()
BEGIN
  DECLARE i INT DEFAULT 1;
  WHILE i <= 500 DO
    INSERT IGNORE INTO employees (emp_code, name, department, designation, base_salary)
    VALUES (
      CONCAT('EMP', LPAD(i, 4, '0')),
      CONCAT(
        ELT(1 + MOD(i,      30),
          'Rahul','Priya','Amit','Sneha','Raj','Pooja','Suresh','Anita','Vijay','Meena',
          'Arjun','Kavya','Rohit','Divya','Sanjay','Rekha','Anil','Sunita','Deepak','Geeta',
          'Ravi','Mamta','Manoj','Seema','Ashok','Savita','Ramesh','Nisha','Pankaj','Asha'
        ),
        ' ',
        ELT(1 + MOD(i * 7, 20),
          'Kumar','Sharma','Patel','Singh','Verma','Gupta','Joshi','Mehta','Shah','Yadav',
          'Chauhan','Tiwari','Srivastava','Pandey','Mishra','Dubey','Bose','Das','Nair','Rao'
        )
      ),
      ELT(1 + MOD(i,     10),
        'Production','Quality Control','Maintenance','HR','Finance',
        'Logistics','R&D','Safety','IT','Administration'
      ),
      ELT(1 + MOD(i * 3,  8),
        'Junior Engineer','Senior Engineer','Supervisor','Manager',
        'Technician','Analyst','Coordinator','Operator'
      ),
      15000.00 + (MOD(i, 10) * 1000)
    );
    SET i = i + 1;
  END WHILE;
END$$
DELIMITER ;

CALL seed_employees();
DROP PROCEDURE IF EXISTS seed_employees;

SELECT CONCAT('✅ Employees seeded: ', COUNT(*), ' records') AS status FROM employees;
