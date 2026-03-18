package com.example.bipolnavbar

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import bipolstatic.example.navbar.Route
import com.example.bipolnavbar.databinding.ActivityMainBinding
import com.google.android.material.color.DynamicColors

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    
    // Simpan instance fragment agar tidak dibuat ulang
    private val homeFragment = Home()
    private val routeFragment = Route()
    private val announcementFragment = Announcement()
    private var activeFragment: Fragment = homeFragment

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        DynamicColors.applyToActivityIfAvailable(this)
        
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupFragments()

        binding.bottomNavigationView.setOnItemSelectedListener { item ->
            when(item.itemId){
                R.id.home -> switchFragment(homeFragment)
                R.id.route -> switchFragment(routeFragment)
                R.id.announcement -> switchFragment(announcementFragment)
            }
            true
        }
    }

    private fun setupFragments() {
        // Tambahkan semua fragment ke FragmentManager tapi sembunyikan yang lain
        supportFragmentManager.beginTransaction().apply {
            add(R.id.frame_layout, announcementFragment, "announcement").hide(announcementFragment)
            add(R.id.frame_layout, routeFragment, "route").hide(routeFragment)
            add(R.id.frame_layout, homeFragment, "home") // Home fragment tampil pertama
        }.commit()
    }

    private fun switchFragment(fragment: Fragment) {
        if (fragment !== activeFragment) {
            supportFragmentManager.beginTransaction()
                .hide(activeFragment)
                .show(fragment)
                .commit()
            activeFragment = fragment
        }
    }
}
