import puppeteer from "puppeteer";
import dotenv from "dotenv";

dotenv.config();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Login function
async function linkedInLogin(page) {
  try {
    console.log('🔐 Logging into LinkedIn...');
    await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2" });
    
    await page.waitForSelector('input[name="session_key"]', { timeout: 10000 });
    await page.type('input[name="session_key"]', process.env.LINKEDIN_USERNAME, { delay: 100 });
    await page.type('input[name="session_password"]', process.env.LINKEDIN_PASSWORD, { delay: 100 });
    
    await page.keyboard.press("Enter");
    try {
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
      console.log('✅ Login successful!');
    } catch (navError) {
      if (navError.message.includes("Navigation timeout")) {
        console.log("⚠️ Navigation timeout, but proceeding assuming login success...");
      } else {
        throw navError;
      }
    }
    
    await sleep(3000);
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }
}

// Scroll using mouse wheel
async function scrollWithMouseWheel(page, scrollTimes = 15, scrollAmount = 800, delayMs = 1500) {
  console.log(`🐭 Starting to scroll with mouse wheel ${scrollTimes} times`);

  for (let i = 0; i < scrollTimes; i++) {
    await page.mouse.wheel({ deltaY: scrollAmount });
    console.log(`🐾 Scrolled ${i + 1} times with mouse wheel`);
    await sleep(delayMs);
  }

  console.log('✅ Finished scrolling with mouse wheel');
}

// Main automation function
async function linkedInAutomation() {
  if (!process.env.LINKEDIN_USERNAME || !process.env.LINKEDIN_PASSWORD) {
    console.error('❌ Error: LINKEDIN_USERNAME and LINKEDIN_PASSWORD must be set in .env file');
    return;
  }

  const browser = await puppeteer.launch({ 
    headless: false, 
    defaultViewport: null, 
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox'] 
  });

  try {
    const page = (await browser.pages())[0];
    page.setDefaultNavigationTimeout(60000);

    // Log in to LinkedIn
    const loggedIn = await linkedInLogin(page);
    if (!loggedIn) {
      await browser.close();
      return;
    }

    // Scroll the feed using mouse wheel
    await scrollWithMouseWheel(page, 15, 800, 1500);

    console.log('\n✅✅✅ Scrolling automation completed! ✅✅✅');

    // Keep browser open for observation
    console.log('\n⏸️ Browser will stay open for 30 seconds...');
    await sleep(30000);

    // Uncomment below to close browser automatically after
    // await browser.close();

  } catch (error) {
    console.error('❌ Automation error:', error.message);
  }
}

linkedInAutomation();
