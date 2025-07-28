const { Sequelize } = require('sequelize');
const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

let sequelize = null;
let models = null;

const defineModels = (sequelizeInstance) => ({
  SalesInvoices: sequelizeInstance.define('SalesInvoices', {
    tpin: { type: Sequelize.STRING, allowNull: false },
    bhfId: { type: Sequelize.STRING, allowNull: false },
    custTpin: { type: Sequelize.STRING },
    custNm: { type: Sequelize.STRING },
    salesTyCd: { type: Sequelize.STRING },
    rcptTyCd: { type: Sequelize.STRING },
    pmtTyCd: { type: Sequelize.STRING },
    salesSttsCd: { type: Sequelize.STRING },
    cfmDt: { type: Sequelize.STRING },
    salesDt: { type: Sequelize.STRING },
    stockRlsDt: { type: Sequelize.STRING },
    totItemCnt: { type: Sequelize.INTEGER },
    totTaxblAmt: { type: Sequelize.FLOAT },
    totTaxAmt: { type: Sequelize.FLOAT },
    totAmt: { type: Sequelize.FLOAT },
    remark: { type: Sequelize.STRING },
    itemList: { type: Sequelize.TEXT }, // JSON string of items
    originalPayload: { type: Sequelize.TEXT, allowNull: false },
    processedPayload: { type: Sequelize.TEXT },
    response: { type: Sequelize.TEXT },
    zra_confirmation: { type: Sequelize.INTEGER, defaultValue: 0 },
    receivedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
  }, { indexes: [{ fields: ['receivedAt'] }, { fields: ['zra_confirmation'] }] }),
  PurchaseInvoices: sequelizeInstance.define('PurchaseInvoices', {
    tpin: { type: Sequelize.STRING, allowNull: false },
    bhfId: { type: Sequelize.STRING, allowNull: false },
    spplrTpin: { type: Sequelize.STRING },
    spplrNm: { type: Sequelize.STRING },
    spplrBhfId: { type: Sequelize.STRING },
    spplrInvcNo: { type: Sequelize.INTEGER },
    regTyCd: { type: Sequelize.STRING },
    pchsTyCd: { type: Sequelize.STRING },
    rcptTyCd: { type: Sequelize.STRING },
    pmtTyCd: { type: Sequelize.STRING },
    pchsSttsCd: { type: Sequelize.STRING },
    cfmDt: { type: Sequelize.STRING },
    pchsDt: { type: Sequelize.STRING },
    totItemCnt: { type: Sequelize.INTEGER },
    totTaxblAmt: { type: Sequelize.FLOAT },
    totTaxAmt: { type: Sequelize.FLOAT },
    totAmt: { type: Sequelize.FLOAT },
    remark: { type: Sequelize.STRING },
    itemList: { type: Sequelize.TEXT }, // JSON string of items
    originalPayload: { type: Sequelize.TEXT, allowNull: false },
    processedPayload: { type: Sequelize.TEXT },
    response: { type: Sequelize.TEXT },
    zra_confirmation: { type: Sequelize.INTEGER, defaultValue: 0 },
    status: { type: Sequelize.STRING, defaultValue: 'pending' },
    receivedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
  }, { indexes: [{ fields: ['receivedAt'] }, { fields: ['zra_confirmation'] }, { fields: ['spplrInvcNo'] }] }),
  Items: sequelizeInstance.define('Items', {
    itemId: { type: Sequelize.STRING, unique: true, allowNull: false },
    tpin: { type: Sequelize.STRING, allowNull: false },
    bhfId: { type: Sequelize.STRING, allowNull: false },
    itemCd: { type: Sequelize.STRING },
    itemClsCd: { type: Sequelize.STRING },
    itemTyCd: { type: Sequelize.STRING },
    itemNm: { type: Sequelize.STRING },
    itemStdNm: { type: Sequelize.STRING },
    orgnNatCd: { type: Sequelize.STRING },
    pkgUnitCd: { type: Sequelize.STRING },
    qtyUnitCd: { type: Sequelize.STRING },
    vatCatCd: { type: Sequelize.STRING },
    useYn: { type: Sequelize.STRING },
    currentStock: { type: Sequelize.FLOAT, defaultValue: 0 },
    isService: { type: Sequelize.BOOLEAN, defaultValue: false },
    originalPayload: { type: Sequelize.TEXT, allowNull: false },
    processedPayload: { type: Sequelize.TEXT },
    response: { type: Sequelize.TEXT },
    zra_confirmation: { type: Sequelize.INTEGER, defaultValue: 0 },
    receivedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
  }, { indexes: [{ fields: ['receivedAt'] }, { fields: ['zra_confirmation'] }, { fields: ['itemId'] }] }),
  Stocks: sequelizeInstance.define('Stocks', {
    tpin: { type: Sequelize.STRING, allowNull: false },
    bhfId: { type: Sequelize.STRING, allowNull: false },
    sarTyCd: { type: Sequelize.STRING },
    sarNo: { type: Sequelize.INTEGER },
    orgSarNo: { type: Sequelize.INTEGER },
    regTyCd: { type: Sequelize.STRING },
    custTpin: { type: Sequelize.STRING },
    custNm: { type: Sequelize.STRING },
    custBhfId: { type: Sequelize.STRING },
    ocrnDt: { type: Sequelize.STRING },
    totItemCnt: { type: Sequelize.INTEGER },
    totTaxblAmt: { type: Sequelize.FLOAT },
    totTaxAmt: { type: Sequelize.FLOAT },
    totAmt: { type: Sequelize.FLOAT },
    remark: { type: Sequelize.STRING },
    itemList: { type: Sequelize.TEXT }, // JSON string of items
    originalPayload: { type: Sequelize.TEXT, allowNull: false },
    processedPayload: { type: Sequelize.TEXT },
    response: { type: Sequelize.TEXT },
    zra_confirmation: { type: Sequelize.INTEGER, defaultValue: 0 },
    receivedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
  }, { indexes: [{ fields: ['receivedAt'] }, { fields: ['zra_confirmation'] }] }),
  Imports: sequelizeInstance.define('Imports', {
    tpin: { type: Sequelize.STRING, allowNull: false },
    bhfId: { type: Sequelize.STRING, allowNull: false },
    taskCd: { type: Sequelize.STRING },
    dclDe: { type: Sequelize.STRING },
    importItemList: { type: Sequelize.TEXT }, // JSON string of items
    originalPayload: { type: Sequelize.TEXT, allowNull: false },
    processedPayload: { type: Sequelize.TEXT },
    response: { type: Sequelize.TEXT },
    zra_confirmation: { type: Sequelize.INTEGER, defaultValue: 0 },
    status: { type: Sequelize.STRING, defaultValue: 'pending' },
    receivedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
  }, { indexes: [{ fields: ['receivedAt'] }, { fields: ['zra_confirmation'] }, { fields: ['taskCd'] }] }),
  Logs: sequelizeInstance.define('Logs', {
    eventType: { type: Sequelize.STRING, allowNull: false },
    details: { type: Sequelize.TEXT, allowNull: false },
    timestamp: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
  }, { indexes: [{ fields: ['timestamp'] }] }),
  Init: sequelizeInstance.define('Init', {
    tin: { type: Sequelize.STRING },
    taxprNm: { type: Sequelize.STRING },
    bsnsActv: { type: Sequelize.STRING, allowNull: true },
    bhfId: { type: Sequelize.STRING },
    bhfNm: { type: Sequelize.STRING },
    bhfOpenDt: { type: Sequelize.STRING },
    prvncNm: { type: Sequelize.STRING },
    dstrtNm: { type: Sequelize.STRING, allowNull: true },
    sctrNm: { type: Sequelize.STRING },
    locDesc: { type: Sequelize.STRING },
    hqYn: { type: Sequelize.STRING },
    mgrNm: { type: Sequelize.STRING },
    mgrTelNo: { type: Sequelize.STRING },
    mgrEmail: { type: Sequelize.STRING },
    sdcId: { type: Sequelize.STRING },
    mrcNo: { type: Sequelize.STRING },
    lastPchsInvcNo: { type: Sequelize.INTEGER },
    lastSaleRcptNo: { type: Sequelize.INTEGER },
    lastInvcNo: { type: Sequelize.INTEGER, allowNull: true },
    lastSaleInvcNo: { type: Sequelize.INTEGER },
    lastTrainInvcNo: { type: Sequelize.INTEGER, allowNull: true },
    lastProfrmInvcNo: { type: Sequelize.INTEGER, allowNull: true },
    lastCopyInvcNo: { type: Sequelize.INTEGER, allowNull: true }
  }),
  StandardCodes: sequelizeInstance.define('StandardCodes', {
    cdCls: { type: Sequelize.STRING, allowNull: false },
    cdClsNm: { type: Sequelize.STRING, allowNull: false },
    cd: { type: Sequelize.STRING, allowNull: false },
    cdNm: { type: Sequelize.STRING, allowNull: false },
    uniqueKey: { type: Sequelize.STRING, unique: true }
  }, { indexes: [{ unique: true, fields: ['uniqueKey'] }] }),
  ItemClassCodes: sequelizeInstance.define('ItemClassCodes', {
    itemClsCd: { type: Sequelize.STRING, primaryKey: true },
    itemClsNm: { type: Sequelize.STRING, allowNull: false },
    itemClsLvl: { type: Sequelize.INTEGER },
    taxTyCd: { type: Sequelize.STRING },
    mjrTgYn: { type: Sequelize.STRING },
    useYn: { type: Sequelize.STRING }
  }, { indexes: [{ unique: true, fields: ['itemClsCd'] }] }),
  LastGetTime: sequelizeInstance.define('LastGetTime', {
    process: { type: Sequelize.STRING, primaryKey: true },
    lastReqDt: { type: Sequelize.STRING, allowNull: false }
  }, { timestamps: true, indexes: [{ unique: true, fields: ['process'] }] }),
  ZRANotices: sequelizeInstance.define('ZRANotices', {
    noticeId: { type: Sequelize.STRING, primaryKey: true },
    title: { type: Sequelize.STRING, allowNull: false },
    content: { type: Sequelize.TEXT },
    publishDt: { type: Sequelize.STRING },
    expiryDt: { type: Sequelize.STRING }
  }, { timestamps: false, indexes: [{ unique: true, fields: ['noticeId'] }] }),
    ImportsData: sequelizeInstance.define('ImportsData', {
    taskCd: { type: Sequelize.STRING },
    dclDe: { type: Sequelize.STRING },
    itemSeq: { type: Sequelize.INTEGER },
    dclNo: { type: Sequelize.STRING },
    hsCd: { type: Sequelize.STRING },
    itemNm: { type: Sequelize.STRING },
    imptItemsttsCd: { type: Sequelize.STRING },
    orgnNatCd: { type: Sequelize.STRING },
    exptNatCd: { type: Sequelize.STRING },
    pkg: { type: Sequelize.INTEGER },
    pkgUnitCd: { type: Sequelize.STRING },
    qty: { type: Sequelize.INTEGER },
    qtyUnitCd: { type: Sequelize.STRING },
    totWt: { type: Sequelize.FLOAT },
    netWt: { type: Sequelize.FLOAT },
    spplrNm: { type: Sequelize.STRING },
    agntNm: { type: Sequelize.STRING },
    invcFcurAmt: { type: Sequelize.FLOAT },
    invcFcurCd: { type: Sequelize.STRING },
    invcFcurExcrt: { type: Sequelize.FLOAT },
    dclRefNum: { type: Sequelize.STRING },
    System_Request_date: { type: Sequelize.STRING, allowNull: false },
    originalPayload: { type: Sequelize.TEXT, allowNull: false },
    processedPayload: { type: Sequelize.TEXT },
    response: { type: Sequelize.TEXT },
    receivedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    status: { type: Sequelize.STRING, defaultValue: 'pending' }
  }, { indexes: [{ fields: ['receivedAt'] }, { fields: ['System_Request_date'] }] }),
  PurchasesData: sequelizeInstance.define('PurchasesData', {
    spplrTpin: { type: Sequelize.STRING },
    spplrNm: { type: Sequelize.STRING },
    spplrBhfId: { type: Sequelize.STRING },
    spplrInvcNo: { type: Sequelize.INTEGER },
    rcptTyCd: { type: Sequelize.STRING },
    pmtTyCd: { type: Sequelize.STRING },
    cfmDt: { type: Sequelize.STRING },
    salesDt: { type: Sequelize.STRING },
    stockRlsDt: { type: Sequelize.STRING },
    totItemCnt: { type: Sequelize.INTEGER },
    totTaxblAmt: { type: Sequelize.FLOAT },
    totTaxAmt: { type: Sequelize.FLOAT },
    totAmt: { type: Sequelize.FLOAT },
    remark: { type: Sequelize.STRING },
    itemSeq: { type: Sequelize.INTEGER },
    itemCd: { type: Sequelize.STRING },
    itemClsCd: { type: Sequelize.STRING },
    itemNm: { type: Sequelize.STRING },
    bcd: { type: Sequelize.STRING },
    pkgUnitCd: { type: Sequelize.STRING },
    pkg: { type: Sequelize.INTEGER },
    qtyUnitCd: { type: Sequelize.STRING },
    qty: { type: Sequelize.INTEGER },
    prc: { type: Sequelize.FLOAT },
    splyAmt: { type: Sequelize.FLOAT },
    dcRt: { type: Sequelize.FLOAT },
    dcAmt: { type: Sequelize.FLOAT },
    vatCatCd: { type: Sequelize.STRING },
    iplCatCd: { type: Sequelize.STRING },
    tlCatCd: { type: Sequelize.STRING },
    exciseTxCatCd: { type: Sequelize.STRING },
    vatTaxblAmt: { type: Sequelize.FLOAT },
    exciseTaxblAmt: { type: Sequelize.FLOAT },
    iplTaxblAmt: { type: Sequelize.FLOAT },
    tlTaxblAmt: { type: Sequelize.FLOAT },
    taxblAmt: { type: Sequelize.FLOAT },
    vatAmt: { type: Sequelize.FLOAT },
    iplAmt: { type: Sequelize.FLOAT },
    tlAmt: { type: Sequelize.FLOAT },
    exciseTxAmt: { type: Sequelize.FLOAT },
    totAmtItem: { type: Sequelize.FLOAT },
    System_Request_date: { type: Sequelize.STRING, allowNull: false },
    originalPayload: { type: Sequelize.TEXT, allowNull: false },
    processedPayload: { type: Sequelize.TEXT },
    response: { type: Sequelize.TEXT },
    receivedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    status: { type: Sequelize.STRING, defaultValue: 'pending' }
  }, { indexes: [{ fields: ['receivedAt'] }, { fields: ['System_Request_date'] }] })
});

async function ensureDirectoryExists(dirPath) {
  try {
    await fs.promises.access(dirPath);
  } catch (error) {
    await fs.promises.mkdir(dirPath, { recursive: true });
    logger.info(`Created directory: ${dirPath}`);
  }
}

async function testAndCreateDatabase() {
  try {
    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    await ensureDirectoryExists(dataDir);

    const dbPath = path.join(dataDir, 'nodeCon.sqlite');
    const dbExists = fs.existsSync(dbPath);

    logger.info(`SQLite database path: ${dbPath}`);
    logger.info(`Database exists: ${dbExists}`);

    // Close existing connection if any
    if (sequelize) {
      await sequelize.close();
      sequelize = null;
      models = null;
    }

    // Create new Sequelize instance with SQLite
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath,
      logging: (msg) => logger.info(`SQLite: ${msg}`),
      define: {
        timestamps: true,
        underscored: false
      }
    });

    // Test the connection
    await sequelize.authenticate();
    logger.info('SQLite connection established successfully');

    // Define models
    models = defineModels(sequelize);

    // Sync database (create tables if they don't exist)
    await sequelize.sync({ force: false });
    logger.info('Database synchronized successfully');

    // Check if tables exist and have data
    let tablesExist = false;
    try {
      const tableNames = ['SalesInvoices', 'PurchaseInvoices', 'Items', 'Stocks', 'Imports', 'Logs', 'Init', 'StandardCodes', 'ItemClassCodes', 'LastGetTime', 'ZRANotices', 'ImportsData', 'PurchasesData'];
      const tableChecks = await Promise.all(
        tableNames.map(async (tableName) => {
          try {
            const model = models[tableName];
            await model.findOne();
            return true;
          } catch (error) {
            return false;
          }
        })
      );
      tablesExist = tableChecks.every(check => check);
    } catch (error) {
      logger.warn(`Error checking tables: ${error.message}`);
    }

    // Create initial log entries if this is a new database
    if (!dbExists || !tablesExist) {
      try {
        await models.Logs.bulkCreate([
          { eventType: 'creation', details: 'SQLite database created' },
          { eventType: 'creation', details: 'Tables created: SalesInvoices, PurchaseInvoices, Items, Stocks, Imports, Logs, Init, StandardCodes, ItemClassCodes, LastGetTime, ZRANotices' }
        ]);
        logger.info('Initial log entries created');
      } catch (error) {
        logger.warn(`Could not create initial logs: ${error.message}`);
      }
    }

    logger.info('Tables synced: SalesInvoices, PurchaseInvoices, Items, Stocks, Imports, Logs, Init, StandardCodes, ItemClassCodes, LastGetTime, ZRANotices, ImportsData, PurchasesData');
    return { 
      success: true, 
      tables: Object.keys(models), 
      dbExists: dbExists && tablesExist,
      dbPath: dbPath
    };
  } catch (error) {
    logger.error(`Database setup error: ${error.message}`);
    return { success: false, error: error.message, dbExists: false };
  }
}

async function checkConnection() {
  try {
    if (!sequelize) {
      return await testAndCreateDatabase();
    }

    await sequelize.authenticate();
    logger.info('Database connection is healthy');

    // Verify tables exist
    const tableNames = ['SalesInvoices', 'PurchaseInvoices', 'Items', 'Stocks', 'Imports', 'Logs', 'Init', 'StandardCodes', 'ItemClassCodes', 'LastGetTime', 'ZRANotices', 'ImportsData', 'PurchasesData'];
    let tablesExist = true;

    for (const tableName of tableNames) {
      try {
        await models[tableName].findOne();
      } catch (error) {
        tablesExist = false;
        break;
      }
    }

    return { success: true, dbExists: tablesExist };
  } catch (error) {
    logger.error(`Connection check failed: ${error.message}`);
    return { success: false, error: error.message, dbExists: false };
  }
}

async function dumpDatabase() {
  try {
    const dataDir = path.join(__dirname, 'data');
    const dbPath = path.join(dataDir, 'nodeCon.sqlite');

    if (sequelize) {
      await sequelize.close();
      sequelize = null;
      models = null;
    }

    if (fs.existsSync(dbPath)) {
      await fs.promises.unlink(dbPath);
      logger.info('SQLite database file deleted successfully');
    } else {
      logger.info('No SQLite database file found to delete');
    }

    return { success: true };
  } catch (error) {
    logger.error(`Dump database error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = { 
  testAndCreateDatabase, 
  checkConnection, 
  dumpDatabase, 
  sequelize: () => sequelize, 
  models: () => models, 
  logger 
};