const puppeteer = require('puppeteer')
const axios = require('axios')
const CREDS = require('./creds')

const USERNAME_SELECTOR = '#pseudonym_session_unique_id'
const PASSWORD_SELECTOR = '#pseudonym_session_password'
const LOGIN_BUTTON_SELECTOR = 'button[type="submit"]'

function parseArguments() {
  const gradebookUrl = process.argv[2]
  const baseUrl = gradebookUrl.match('(.*\.com).*')[1]
  const courseId = gradebookUrl.match('.*\/courses\/([0-9]+)\/.*')[1]
  const enrollmentAPIUrl = `${baseUrl}/api/v1/courses/${courseId}/enrollments`
  return { gradebookUrl, enrollmentAPIUrl }
}

async function login(page) {
  await page.click(USERNAME_SELECTOR)
  await page.keyboard.type(CREDS.username)

  await page.click(PASSWORD_SELECTOR)
  await page.keyboard.type(CREDS.password)

  await page.click(LOGIN_BUTTON_SELECTOR)
  await page.waitForNavigation({ waitUntil: 'networkidle0' })
}

async function getAPIGrades(url) {
  try {
    const headers = { Authorization: `Bearer ${CREDS.api_token}` }
    console.log('hitting API: ', url)
    const response = await axios.get(url, { headers })
    return response.data.map(enrollment => ({...enrollment.grades, enrollment_id: enrollment.id, user_id: enrollment.user_id}))
  } catch (error) {
    console.log('failure')
    console.error(error);
    return error
  }
}

async function scrape(url) {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  console.log(`visiting ${url}`)
  await page.goto(url)

  console.log('logging in...')
  await login(page)

  const totals = await page.evaluate(() => {
    const classNames = Array.from(document.querySelectorAll('.total-cell.total_grade')).map(grade => grade.parentElement.className)
    const userIDs = classNames.map(name => name.match('student_([0-9]+)')[1])
    const totalGrades = Array.from(document.querySelectorAll('.total-cell.total_grade .grades')).map(grade => grade.innerText)
    return totalGrades.map((grade, index) => ({ user_id: userIDs[index], grade: grade }))
  })
  console.log('Totals in the Gradebook are: ', totals)
  browser.close()
}

async function run() {
  const args = parseArguments()
  await scrape(args.gradebookUrl)

  const grades = await getAPIGrades(args.enrollmentAPIUrl)
  console.log('Grades from enrollments API: ', grades)
}

run()
