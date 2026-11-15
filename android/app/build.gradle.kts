plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.demo.passwordvault"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.demo.passwordvault"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"
        buildConfigField("boolean", "ALLOW_SCREENSHOTS", "false")
        // מספר הבנייה ב-GitHub Actions (0 בבנייה מקומית) – לכפתור "בדיקת עדכונים"
        buildConfigField("int", "BUILD_NUMBER", System.getenv("GITHUB_RUN_NUMBER") ?: "0")
    }

    buildTypes {
        // גרסה לצילומי מסך לתיעוד בלבד: זהה ל-debug, אבל בלי חסימת צילום מסך
        create("screenshot") {
            initWith(getByName("debug"))
            applicationIdSuffix = ".screenshot"
            buildConfigField("boolean", "ALLOW_SCREENSHOTS", "true")
            matchingFallbacks += listOf("debug")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    testOptions {
        unitTests.isReturnDefaultValues = false
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    testImplementation("junit:junit:4.13.2")
}
