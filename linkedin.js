import puppeteer from "puppeteer";
import dotenv from "dotenv";

dotenv.config();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Login function with navigation timeout handling
async function linkedInLogin(page) {
  try {
    console.log('🔐 Logging into LinkedIn...');
    await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2" });

    await page.waitForSelector('input[name="session_key"]', { timeout: 10000 });
    await page.type('input[name="session_key"]', process.env.LINKEDIN_USERNAME, { delay: randomDelay(150, 250) });
    await page.type('input[name="session_password"]', process.env.LINKEDIN_PASSWORD, { delay: randomDelay(150, 250) });

    await page.keyboard.press("Enter");
    try {
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
      console.log('✅ Login successful!');
    } catch (navError) {
      if (navError.message.includes("Navigation timeout")) {
        console.log("⚠️ Navigation timeout after login, proceeding assuming login success...");
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

// Scroll down one post using mouse wheel
async function scrollOnce(page) {
  console.log('🐭 Scrolling down one post...');
  await page.mouse.wheel({ deltaY: 800 });
  await sleep(randomDelay(3000, 4500));
}

// Like a post by clicking thumbs-up SVG within post
async function likePost(post) {
  try {
    const likeButton = await post.$('svg use[href="#thumbs-up-outline-small"]');
    if (!likeButton) {
      console.log('❌ Like icon not found in post');
      return false;
    }

    const likeBtnParent = await likeButton.evaluateHandle(node => node.parentElement);
    if (!likeBtnParent) {
      console.log('❌ Could not get like button parent');
      return false;
    }

    const isLiked = await likeBtnParent.evaluate(el => el.getAttribute('aria-pressed') === 'true');

    if (isLiked) {
      console.log('⚠️ Already liked');
      return false;
    }

    await likeBtnParent.click();
    console.log('👍 Post liked!');
    await sleep(randomDelay(2000, 4000));
    return true;
  } catch (error) {
    console.error('❌ Error liking post:', error.message);
    return false;
  }
}

// Comment on a specific post element properly scoped, avoiding global selection
async function commentOnSpecificPost(post, commentText = "Interested") {
  try {
    const commentIcon = await post.$('svg use[href="#comment-small"]');
    if (!commentIcon) {
      console.log('❌ Comment icon not found in post');
      return false;
    }
    const commentBtnParent = await commentIcon.evaluateHandle(node => node.parentElement.parentElement);
    await commentBtnParent.click();
    console.log('💬 Opened comment box in current post');
    await sleep(3500);

    const commentBox = await post.$('div.ql-editor[contenteditable="true"][aria-placeholder="Add a comment…"]');
    if (!commentBox) {
      console.log('❌ Comment box not found in post');
      return false;
    }
    await commentBox.click();
    await sleep(1000);

    await commentBox.type(commentText, { delay: randomDelay(150, 250) });
    console.log(`💬 Typed comment: ${commentText}`);

    await sleep(randomDelay(2000, 3000));

    const postButton = await post.$('button.comments-comment-box__submit-button--cr');
    if (!postButton) {
      console.log('❌ Comment submit button not found in post');
      return false;
    }
    await postButton.click();
    console.log('📤 Comment submitted in post!');
    await sleep(randomDelay(3000, 5000));
    return true;
  } catch (error) {
    console.error('❌ Error commenting in post:', error.message);
    return false;
  }
}

// Main automation flow
async function linkedInAutomation() {
  if (!process.env.LINKEDIN_USERNAME || !process.env.LINKEDIN_PASSWORD) {
    console.error('❌ Please set LINKEDIN_USERNAME and LINKEDIN_PASSWORD in your .env file');
    return;
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = (await browser.pages())[0];
    page.setDefaultNavigationTimeout(60000);

    // Step 1: Login
    const loggedIn = await linkedInLogin(page);
    if (!loggedIn) {
      await browser.close();
      return;
    }

    // Go to LinkedIn feed
    try {
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (error) {
      if (error.message.includes('Navigation timeout')) {
        console.log('⚠️ Navigation timeout loading feed, continuing anyway...');
      } else {
        throw error;
      }
    }
    await sleep(5000);

    const maxPosts = 10; // Limit number of posts to process
    let postsProcessed = 0;

    while (postsProcessed < maxPosts) {
      const posts = await page.$$('.feed-shared-update-v2');
      if (posts.length === 0) {
        console.log('❌ No posts found');
        break;
      }

      const post = posts[postsProcessed];
      if (!post) {
        console.log('⚠️ No more new posts to process');
        break;
      }

      await post.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await sleep(3500);

      await likePost(post);

      const commentSuccess = await commentOnSpecificPost(post, "Interested");
      if (!commentSuccess) {
        console.log('⚠️ Comment failed for this post');
      }

      postsProcessed++;

      await scrollOnce(page);
    }

    console.log('\n✅ Automation completed!');
    await sleep(5000);

    // await browser.close();
  } catch (err) {
    console.error('❌ Unexpected automation error:', err);
  }
}

linkedInAutomation();
