package com.example.bipolnavbar

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.OvershootInterpolator
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.bipolnavbar.databinding.FragmentAnnouncementBinding
import com.example.bipolnavbar.databinding.ItemAnnouncementBinding
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET

class Announcement : Fragment() {

    private var _binding: FragmentAnnouncementBinding? = null
    private val binding get() = _binding
    private lateinit var announcementService: AnnouncementService
    private lateinit var adapter: AnnouncementAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
        _binding = FragmentAnnouncementBinding.inflate(inflater, container, false)
        return binding?.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupSwipeRefresh()
        announcementService = AnnouncementService.create()
        fetchAnnouncements()
    }

    private fun setupSwipeRefresh() {
        binding?.swipeRefreshLayout?.apply {
            setColorSchemeResources(android.R.color.holo_blue_bright, android.R.color.holo_purple)
            setProgressBackgroundColorSchemeColor(resources.getColor(android.R.color.background_dark, null))
            setOnRefreshListener { fetchAnnouncements(isRefresh = true) }
        }
    }

    private fun setupRecyclerView() {
        adapter = AnnouncementAdapter()
        binding?.recyclerView?.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@Announcement.adapter
        }
    }

    private fun fetchAnnouncements(isRefresh: Boolean = false) {
        lifecycleScope.launch {
            try {
                if (!isRefresh) {
                    binding?.shimmerView?.apply { visibility = View.VISIBLE; startShimmer() }
                    binding?.recyclerView?.visibility = View.GONE
                }

                if (isRefresh) delay(1000)

                val response = try { announcementService.getAnnouncements() } catch (e: Exception) { null }
                val announcements = if (response?.isSuccessful == true && response.body()?.data?.isNotEmpty() == true) {
                    response.body()!!.data
                } else {
                    getDummyAnnouncements()
                }

                binding?.apply {
                    shimmerView.stopShimmer()
                    shimmerView.visibility = View.GONE
                    swipeRefreshLayout.isRefreshing = false
                    recyclerView.visibility = View.VISIBLE
                    adapter.submitList(announcements)
                }
            } catch (e: Exception) {
                binding?.swipeRefreshLayout?.isRefreshing = false
            }
        }
    }

    private fun getDummyAnnouncements() = listOf(
        AnnouncementItem("System Update", 1, "Halo! BipolTracker baru saja memperbarui algoritma pelacakan mood untuk hasil yang lebih akurat.", "Sekarang"),
        AnnouncementItem("Mental Health Tips", 2, "Tahukah Anda? Tidur yang cukup sangat berpengaruh pada stabilitas mood penderita Bipolar.", "2 jam yang lalu"),
        AnnouncementItem("Community News", 3, "Fitur grup diskusi akan segera hadir! Tetap terhubung dengan pejuang lainnya.", "Kemarin"),
        AnnouncementItem("Reminder", 4, "Jangan lupa mencatat jurnal malam ini sebelum beristirahat.", "2 hari yang lalu"),
        AnnouncementItem("Security", 5, "Kami telah memperkuat enkripsi data Anda untuk privasi yang lebih maksimal.", "3 hari yang lalu")
    )

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}

data class AnnouncementItem(@SerializedName("created_by") val createdBy: String, val id: Int, val message: String, val time: String)

class AnnouncementAdapter : RecyclerView.Adapter<AnnouncementAdapter.ViewHolder>() {
    private var data: List<AnnouncementItem> = emptyList()
    private var lastPosition = -1

    fun submitList(newList: List<AnnouncementItem>) {
        data = newList
        lastPosition = -1
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemAnnouncementBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(data[position])
        setSpringAnimation(holder.itemView, position)
    }

    // GSAP-STYLE SPRING ANIMATION
    private fun setSpringAnimation(view: View, position: Int) {
        if (position > lastPosition) {
            view.alpha = 0f
            view.translationY = 200f
            view.scaleX = 0.8f
            view.scaleY = 0.8f

            view.animate()
                .translationY(0f)
                .alpha(1f)
                .scaleX(1f)
                .scaleY(1f)
                .setDuration(800)
                .setInterpolator(OvershootInterpolator(1.4f)) // Memberikan efek "Spring/Bounce"
                .setStartDelay(position * 100L) // Stagger effect
                .start()
            
            lastPosition = position
        }
    }

    override fun getItemCount() = data.size

    class ViewHolder(private val binding: ItemAnnouncementBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: AnnouncementItem) {
            binding.apply {
                createdByTextView.text = item.createdBy
                messageTextView.text = item.message
                timeTextView.text = item.time
                
                // Advanced Touch Feedback
                root.setOnClickListener {
                    root.animate()
                        .scaleX(0.9f)
                        .scaleY(0.9f)
                        .setDuration(200)
                        .setInterpolator(OvershootInterpolator())
                        .withEndAction {
                            root.animate().scaleX(1f).scaleY(1f).setDuration(200).start()
                        }.start()
                }
            }
        }
    }
}

data class AnnouncementResponse(val data: List<AnnouncementItem>, val message: String, val statusCode: Int)

interface AnnouncementService {
    @GET("announcement") suspend fun getAnnouncements(): Response<AnnouncementResponse>
    companion object {
        fun create(): AnnouncementService {
            val client = OkHttpClient.Builder().addInterceptor { chain ->
                val request = chain.request().newBuilder().header("Authorization", "cff2f609d3accf61df924590eac88bc2e5107eb3df47af97576f3ab6139e59bc").build()
                chain.proceed(request)
            }.build()
            return Retrofit.Builder().baseUrl("https://hexacomm.or.id/api/").client(client).addConverterFactory(GsonConverterFactory.create()).build().create(AnnouncementService::class.java)
        }
    }
}
